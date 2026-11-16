import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {newProcurement,procurementSchema,type ProcurementInput} from '../src/lib/procurement';
import {procurementJourney,procurementDocumentOrder,journeyProgress,type JourneyCheck} from '../src/lib/procurement-journey';
import {db} from '../src/lib/db';
import {suiteCodes,emptyDocumentConfig} from '../src/lib/procurement-workflow-model';
import {saveProcurement,installProcurementTemplate,generateProcurementSuite,attachProcurementFile,readProcurement,procurementSnapshot} from '../src/lib/procurement-db';
import {advanceProcurementJourney,prepareProcurementJourneyDocument,attachProcurementJourneyFile,procurementJourneyProgress,reviewProcurementJourneyDocument} from '../src/lib/procurement-journey-server';
import {procurementPreset} from '../src/lib/procurement-presets';
import {reviewProcurementDocument,transitionProcurement} from '../src/lib/procurement-process';
import {randomUUID} from 'node:crypto';
import {procurementContractDates} from '../src/lib/procurement-contracts';
vi.mock('../src/lib/procurement-preview',()=>({finalizeProcurementWord:async(word:Buffer)=>({word})}));
const allChecks=():JourneyCheck[]=>([...suiteCodes,'E01','V01'] as const).map(code=>({code,ready:true,reason:'',exempt:false}));
it('orders TOR before its report and keeps the original document identifiers',()=>{
 expect(procurementDocumentOrder.slice(0,5)).toEqual(['D01','D02','D04','D03','D05']);expect(new Set(procurementDocumentOrder)).toEqual(new Set(suiteCodes));
 expect(procurementJourney.at(-4)!.id).toBe('D14');expect(procurementJourney.at(-2)!.id).toBe('V01');
});
it('uses a contiguous completed prefix, so future drafts do not permit jumping earlier approvals',()=>{
 const data=newProcurement(),checks=allChecks();data.contractDue='2026-11-20';data.inspection={result:'complete',penalty:'none',notes:''};checks[0].ready=false;checks[0].reason='รอสแกน';
 const progress=journeyProgress(data,checks);expect(progress.current).toBe('D01');expect(progress.done).toBe(0);expect(progress.stages.find(s=>s.id==='D04')!.blockedBy).toBe('D01');
 checks[0].ready=true;expect(journeyProgress(data,checks).current).toBe('debt');
 data.workflow.state='debt_received';expect(journeyProgress(data,checks).current).toBe('debt');expect(journeyProgress(data,checks).stages.find(s=>s.id==='V01')!.ready).toBe(false);
 data.workflow.state='returned_for_voucher';expect(journeyProgress(data,checks).current).toBe('voucher');checks.at(-1)!.ready=false;expect(journeyProgress(data,checks).current).toBe('V01');
});
it('keeps frozen received packets complete without rewriting legacy data or regenerating old documents',()=>{
 const data=newProcurement(),before=JSON.stringify(data);expect(journeyProgress(data,[]).done).toBe(0);expect(JSON.stringify(data)).toBe(before);
 data.workflow.state='closed';data.workflow.packets=[1,2].map(round=>({id:'packet-'+round,round,caseVersion:1,createdAt:'2026-11-16',files:[]}));
 expect(journeyProgress(data,[]).done).toBe(procurementJourney.length);expect(journeyProgress(data,[]).current).toBe('voucher');
});
describe.skipIf(!suiteCodes.every(code=>fs.existsSync('output/procurement-suite/templates/'+code+'.docx')))('journey server in isolated database',()=>{
 let folder:string;
 beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-journey-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'test.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');for(const code of suiteCodes)installProcurementTemplate(fs.readFileSync('output/procurement-suite/templates/'+code+'.docx'),code+'.docx',code);});
 afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
 async function sample(){const {data}=await procurementPreset('purchase');data.title='JOURNEY SYNTHETIC TEST ONLY';data.profile='general';data.egpExemption='none';data.contractDue='2026-11-20';for(const key of Object.keys(data.common))if(!data.common[key])data.common[key]='ทดสอบ';Object.assign(data.common,{vendor:'ร้านจำลอง',item:'วัสดุทดสอบ',agreed:'200.00',offered:'200.00',referencePrice:'200.00',allocatedBudget:'30000.00',remainingBudget:'29800.00',budgetYear:'2570',number:'ทดสอบ/07',day:'16',month:'พฤศจิกายน',year:'2569',deliveryDays:'3',orderDate:'2026-11-16',appointmentDate:'2026-11-16',inspectionDate:'2026-11-16',deliveryDate:'2026-11-16'});data.d01.number='ทดสอบ/01';data.bill={items:[{id:'item-1',description:'วัสดุทดสอบ',quantity:'2',unit:'ชิ้น',unitPrice:'100.00'}],summary:'วัสดุทดสอบ',vatMode:'none',vatRate:'7',referencePriceFromOffer:true};data.tasks=[];data.inspection={result:'complete',penalty:'none',notes:'ข้อมูลจำลองเท่านั้น'};for(const code of suiteCodes){data.documents[code]={...emptyDocumentConfig(),number:'ทดสอบ/'+code,date:'2026-11-16'};if(Object.hasOwn(data.sources,code))data.sources[code as keyof typeof data.sources]='draft';}return procurementSchema.parse(data);}
 const inputOf=({id:_id,version:_v,updatedAt:_at,...input}:ReturnType<typeof readProcurement>)=>input;
 it('keeps sample data out of real defaults and contract calendars without relabeling old cases',async()=>{
  const realData=await sample();realData.common.proposer='เจ้าของงานจริง';const real=saveProcurement(realData),fake=saveProcurement({...realData,sample:true,title:'ตัวอย่างทดสอบเท่านั้น',common:{...realData.common,proposer:'ชื่อสมมุติ'}});
  expect((await procurementPreset('purchase')).data.common.proposer).toBe('เจ้าของงานจริง');
  expect(procurementContractDates([real,fake]).every(date=>date.caseId===real.id)).toBe(true);
  expect(()=>saveProcurement({...inputOf(fake),sample:false},fake.id,fake.version)).toThrow(/สถานะงานจริง/);
  expect(readProcurement(real.id).sample).toBe(false);
 });
 it('selects one newly generated document, rejects stale versions and cannot advance past a missing approval',async()=>{
  let current=saveProcurement(await sample());const prepared=await prepareProcurementJourneyDocument(current.id,current.version,'D01');current=prepared.record;expect(current.documents.D01!.primaryFileId).toBe(prepared.fileId);
  await expect(prepareProcurementJourneyDocument(current.id,current.version-1,'D02')).rejects.toThrow(/เปลี่ยน/);
  await expect(advanceProcurementJourney(current.id,current.version,'D02')).rejects.toThrow(/ก่อน/);await expect(reviewProcurementJourneyDocument(current.id,current.version,'D02')).rejects.toThrow(/ก่อน/);
  await expect(attachProcurementJourneyFile(current.id,current.version,'V01','primary',Buffer.from('%PDF-1.7\nfake'),'fake.pdf')).rejects.toThrow(/รับเอกสารกลับ/);
  expect((await procurementJourneyProgress(current.id)).current).toBe('D01');
 });
 it('walks all stages through returned debt documents, PDF voucher upload and the second receipt',async()=>{
  let current=saveProcurement(await sample());current=(await generateProcurementSuite(current.id,current.version)).record;
  const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC TEST ONLY');
  for(const code of procurementJourney.flatMap(s=>'code'in s&&s.code!=='V01'?[s.code]:[])){
   if(code==='E01')current=(await attachProcurementJourneyFile(current.id,current.version,code,'primary',pdf,'E01-test.pdf')).record;
   else if(code!=='D10'){current=(await attachProcurementJourneyFile(current.id,current.version,code,'signed',pdf,code+'-test-scan.pdf')).record;current=saveProcurement({...inputOf(current),documents:{...current.documents,[code]:{...current.documents[code]!,signatureChecked:true}}},current.id,current.version);}
   current=await reviewProcurementJourneyDocument(current.id,current.version,code);
   const next=await advanceProcurementJourney(current.id,current.version,code);expect(next.progress.stages.find(s=>s.id===code)!.ready).toBe(true);
  }
  const vendor=await attachProcurementFile(current.id,current.version,pdf,'vendor-test.pdf',{code:'OTHER',origin:'vendor',caseVersion:null}),egp=await attachProcurementFile(current.id,current.version,pdf,'egp-test.pdf',{code:'D10',origin:'egp',caseVersion:null});
  const event=(action:string,evidence:string[])=>({action,date:'2026-11-16',actor:'ผู้ทดสอบจำลอง',note:'ไม่ใช่เหตุการณ์จริง',receiptNumber:'TEST',evidence,requestId:randomUUID()});
  current=await transitionProcurement(current.id,current.version,event('send_debt',[vendor,egp]));current=await transitionProcurement(current.id,current.version,event('receive_debt',[vendor]));
  await expect(advanceProcurementJourney(current.id,current.version,'V01')).rejects.toThrow(/ก่อน/);
  current=await transitionProcurement(current.id,current.version,event('return_for_voucher',[vendor]));expect((await procurementJourneyProgress(current.id)).current).toBe('V01');
  await expect(attachProcurementJourneyFile(current.id,current.version,'V01','primary',Buffer.from('image'),'voucher.png')).rejects.toThrow(/PDF/);
  current=(await attachProcurementJourneyFile(current.id,current.version,'V01','primary',pdf,'voucher-test.pdf')).record;current=(await attachProcurementJourneyFile(current.id,current.version,'V01','signed',pdf,'voucher-signed-test.pdf')).record;
  current=saveProcurement({...inputOf(current),documents:{...current.documents,V01:{...current.documents.V01!,signatureChecked:true}}},current.id,current.version);current=await reviewProcurementJourneyDocument(current.id,current.version,'V01');
  expect((await advanceProcurementJourney(current.id,current.version,'V01')).next).toBe('voucher');
  current=await transitionProcurement(current.id,current.version,event('send_voucher',[current.documents.V01!.signedFileId]));expect((await procurementJourneyProgress(current.id)).current).toBe('voucher');
  current=await transitionProcurement(current.id,current.version,event('receive_voucher',[vendor]));expect((await procurementJourneyProgress(current.id)).done).toBe(18);
  expect(procurementSnapshot().cases).toHaveLength(1);
 },60000);
});
