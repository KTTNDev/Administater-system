vi.mock('../src/lib/procurement-preview',()=>({finalizeProcurementWord:async(word:Buffer)=>({word})}));
import {beforeEach,afterEach,it,expect,vi,describe} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import JSZip from 'jszip';
import {db} from '../src/lib/db';
import {newProcurement,procurementSchema,d01Values,d07Values,type ProcurementInput} from '../src/lib/procurement';
import {billSchema,billTotals,billValues,bahtWords,formatMoney} from '../src/lib/procurement-bill';
import {suiteCodes,emptyDocumentConfig} from '../src/lib/procurement-workflow-model';
import {documentTemplates} from '../src/lib/procurement-documents';
import {installProcurementTemplate,saveProcurement,readProcurement,procurementSnapshot,generateProcurementSuite,readProcurementFile,attachProcurementFile} from '../src/lib/procurement-db';
import {procurementPreset} from '../src/lib/procurement-presets';
import {documentChecklist,reviewProcurementDocument,transitionProcurement,documentContentHash} from '../src/lib/procurement-process';
import {procurementSuiteZip,procurementPacketZip} from '../src/lib/procurement-bundle';
import {compareProcurementWord} from '../src/lib/procurement-roundtrip';
import {buildLivePreview} from '../src/lib/procurement-live-preview';
import {wordContentHash} from '../src/lib/procurement-template';
import {suiteMissing} from '../src/lib/procurement-suite';
import {continuationInfo} from '../src/lib/procurement-pagination';
import {exportWorkspace,setStorage} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
const hasPrivateSources=suiteCodes.every(code=>fs.existsSync(path.resolve('output/procurement-suite/templates',code+'.docx')));
describe.skipIf(!hasPrivateSources)('approved private procurement sources',()=>{
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-suite-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'main.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');for(const code of suiteCodes)installProcurementTemplate(fs.readFileSync(path.resolve('output/procurement-suite/templates',code+'.docx')),code+'.docx',code);});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
async function sample(){const {data}=await procurementPreset('purchase');data.title='กระบวนงานทดสอบครบชุด';data.profile='general';data.egpExemption='none';for(const key of Object.keys(data.common))if(!data.common[key])data.common[key]='ทดสอบ';Object.assign(data.common,{vendor:'ร้านทดสอบกลาง',day:'15',month:'พฤศจิกายน',year:'2569',budgetYear:'2570',remainingBudget:'28,940.00',allocatedBudget:'30,000.00',allocatedBudgetWords:'สามหมื่นบาทถ้วน',orderDate:'2026-11-15',appointmentDate:'2026-11-15',deliveryDate:'2026-11-15',inspectionDate:'2026-11-15'});data.inspection={result:'complete',penalty:'none',notes:'ผลตรวจรับทดสอบ'};data.contractDue='2026-11-15';data.d01.number='ทส/01';data.bill={...billSchema.parse({}),items:[{id:'a',description:'กระดาษทดสอบพิเศษ',quantity:'2',unit:'รีม',unitPrice:'500.00',offeredUnitPrice:'510.00'},{id:'b',description:'ปากกาทดสอบสีน้ำเงิน',quantity:'3',unit:'ด้าม',unitPrice:'20.00'}],referencePriceFromOffer:true,summary:'วัสดุทดสอบ จำนวน 2 รายการ'};for(const code of suiteCodes){data.documents[code]={...emptyDocumentConfig(),number:'ทส/'+code,date:'2026-11-15'};if(Object.hasOwn(data.sources,code))data.sources[code as keyof typeof data.sources]='draft';}return data;}
const inputOf=({id:_,version:__,updatedAt:___,...data}:ReturnType<typeof readProcurement>)=>data;
it('takes continuation identifiers from fields actually printed by each form',async()=>{
 const data=await sample();data.documents.D11!.date='2026-11-16';data.common.inspectionDate='2026-11-20';
 const inspection=await continuationInfo(await buildLivePreview(data,'D11'));expect(inspection!.info.date).toBe('20 พฤศจิกายน 2569');expect(inspection!.info.number).toBe('');expect(inspection!.info.memo).toBe(false);
 const terms=await continuationInfo(await buildLivePreview(data,'D04'));expect(terms!.info.number).toBe('');expect(terms!.info.date).toBe('');expect(terms!.info.subject).toContain('วัสดุทดสอบ');
 const memo=await continuationInfo(await buildLivePreview(data,'D01'));expect(memo!.info.number).toBe('ทส/01');expect(memo!.info.memo).toBe(true);
});
it('removes empty legacy tail paragraphs after the last real order date',async()=>{const zip=await JSZip.loadAsync(await buildLivePreview(await sample(),'D09')),xml=await zip.file('word/document.xml')!.async('string');const tail=xml.slice(0,xml.lastIndexOf('<w:sectPr'));const last=[...tail.matchAll(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g)].at(-1)![0];expect(last.replace(/<[^>]*>/g,'')).toContain('วันที่');expect(last).not.toMatch(/<w:drawing/);});
it('allows direct office holders without inheriting acting titles from the source',async()=>{
 const data=await sample();data.common.secretaryActing='';data.common.authorityActing='';
 for(const code of suiteCodes){expect(await suiteMissing(data,code)).toEqual([]);const zip=await JSZip.loadAsync(await buildLivePreview(data,code)),xml=await zip.file('word/document.xml')!.async('string');expect(xml).not.toMatch(/\[(?:secretaryActing|authorityActing)\]|\{\{(?:secretaryActing|authorityActing)\}\}/);}
},20000);
it('calculates once using cents, supports included/excluded/no VAT, and shares prices with D01/D07',async()=>{
 const data=await sample(),totals=billTotals(data.bill);expect(formatMoney(totals.total)).toBe('1,060.00');expect(formatMoney(totals.offeredTotal)).toBe('1,080.00');expect(totals.net+totals.vat).toBe(totals.total);expect(bahtWords(106000n)).toBe('หนึ่งพันหกสิบบาทถ้วน');expect(d07Values(data).agreed).toBe('1,060.00');expect(d07Values(data).offered).toBe('1,080.00');expect(d01Values(data).facts).toContain('วัสดุทดสอบ');expect(billTotals({...data.bill,vatMode:'excluded'}).total).toBe(113420n);expect(billTotals({...data.bill,vatMode:'none'}).vat).toBe(0n);expect(billValues({...data,bill:{...data.bill,items:[{...data.bill.items[0],unitPrice:'-'}]}}).agreed).toBe(data.common.agreed);
});
it('builds all 14 Word files atomically from one bill and preserves source furniture',async()=>{
 const current=saveProcurement(await sample()),result=await generateProcurementSuite(current.id,current.version);expect(Object.keys(result.ids)).toHaveLength(14);
 for(const code of suiteCodes){const file=readProcurementFile(result.ids[code]),zip=await JSZip.loadAsync(file.bytes),source=await JSZip.loadAsync(fs.readFileSync(path.resolve('output/procurement-suite/templates',code+'.docx'))),xml=await zip.file('word/document.xml')!.async('string');expect(xml).not.toMatch(/1,520|1,366|ร้านดินสอสี/);expect(xml).not.toContain('{{');for(const name of Object.keys(source.files))if(!source.files[name].dir&&!['word/document.xml','word/footer1.xml','word/settings.xml'].includes(name))expect(await zip.file(name)!.async('uint8array')).toEqual(await source.file(name)!.async('uint8array'));if(['D04','D05','D09'].includes(code)){expect(xml).toContain('กระดาษทดสอบพิเศษ');expect(xml).toContain('ปากกาทดสอบสีน้ำเงิน');}}
 const zipped=await JSZip.loadAsync(await procurementSuiteZip(current.id));expect(Object.keys(zipped.files).filter(n=>n.endsWith('.docx'))).toHaveLength(14);
 const next=saveProcurement({...inputOf(result.record),bill:{...result.record.bill,items:result.record.bill.items.map(item=>({...item,unitPrice:'900.00'}))}},current.id,result.record.version);await expect(procurementSuiteZip(next.id)).rejects.toThrow(/เปลี่ยน/);expect(procurementSnapshot().files).toHaveLength(14);
},60000);
it('blocks a partial batch without adding any files',async()=>{const data=await sample();data.common.vendor='';const current=saveProcurement(data);await expect(generateProcurementSuite(current.id,current.version)).rejects.toThrow();expect(procurementSnapshot().files).toHaveLength(0);});
it('keeps immutable packets, requires evidence for both receipts, separates rework, and closes only on second receipt',async()=>{
 let current=saveProcurement(await sample());const generated=await generateProcurementSuite(current.id,current.version);current=generated.record;
 const fileIds:string[]=[];for(const code of [...suiteCodes,'E01','V01'] as const){const id=await attachProcurementFile(current.id,current.version,Buffer.from('%PDF-1.7\nscan'),code+'-scan.pdf',{code,origin:['E01','V01'].includes(code)?'elaas':'scan',caseVersion:null});fileIds.push(id);const signedId=code==='V01'?await attachProcurementFile(current.id,current.version,Buffer.from('%PDF-1.7\nscan'),'voucher-signed.pdf',{code:'V01',origin:'scan',caseVersion:null}):id;const config={...(current.documents[code]||emptyDocumentConfig()),primaryFileId:code==='E01'||code==='V01'?id:generated.ids[code],signedFileId:signedId,signatureChecked:true};current=saveProcurement({...inputOf(current),documents:{...current.documents,[code]:config}},current.id,current.version);current=await reviewProcurementDocument(current.id,current.version,{code});}
 const vendor=await attachProcurementFile(current.id,current.version,Buffer.from('%PDF-1.7\nquote'),'quote.pdf',{code:'OTHER',origin:'vendor',caseVersion:null});
 const egpProof=await attachProcurementFile(current.id,current.version,Buffer.from('%PDF-1.7\negp'),'egp-proof.pdf',{code:'D10',origin:'egp',caseVersion:null});
 expect(await documentChecklist(current,procurementSnapshot().files)).toSatisfy((rows:{ready:boolean}[])=>rows.every(row=>row.ready));
 const event=(action:string,extra={})=>({action,date:'2026-11-15',actor:'เจ้าหน้าที่ทดสอบ',note:'หลักฐานทดสอบ',receiptNumber:'รับ-1',evidence:[vendor,egpProof],requestId:randomUUID(),...extra});
 await expect(transitionProcurement(current.id,current.version,event('receive_voucher'))).rejects.toThrow(/ขั้นตอน/);
 const send=event('send_debt');current=await transitionProcurement(current.id,current.version,send);const packet=JSON.stringify(current.workflow.packets[0]);expect((await transitionProcurement(current.id,current.version,send)).version).toBe(current.version);
 current=await transitionProcurement(current.id,current.version,event('rework'));expect(current.workflow.state).toBe('preparing');current=await transitionProcurement(current.id,current.version,event('send_debt'));current=await transitionProcurement(current.id,current.version,event('receive_debt'));current=await transitionProcurement(current.id,current.version,event('return_for_voucher'));expect(current.workflow.state).toBe('returned_for_voucher');current=await transitionProcurement(current.id,current.version,event('send_voucher'));expect(current.workflow.state).toBe('voucher_sent');await expect(transitionProcurement(current.id,current.version,event('receive_voucher',{evidence:[]}))).rejects.toThrow();current=await transitionProcurement(current.id,current.version,event('receive_voucher'));expect(current.workflow.state).toBe('closed');expect(JSON.stringify(current.workflow.packets[0])).toBe(packet);expect((await JSZip.loadAsync(await procurementPacketZip(current.id,current.workflow.packets[0].id))).file('manifest.json')).not.toBeNull();
 expect(()=>saveProcurement({...inputOf(current),common:{...current.common,vendor:'เปลี่ยนร้านหลังปิด'}},current.id,current.version)).toThrow(/ปิดแล้ว/);
 fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');
 const backup=exportWorkspace(),preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');const restored=readProcurement(current.id);expect(restored.workflow.state).toBe('closed');expect(JSON.stringify(restored.workflow.packets[0])).toBe(packet);expect(restored.version).toBeGreaterThan(current.version);expect((await documentChecklist(restored,procurementSnapshot().files)).every(row=>row.ready)).toBe(true);
},60000);
it('rejects forged workflow, cyclic tasks, cross-case evidence, and detects central edits after review',async()=>{
 let current=saveProcurement(await sample());expect(()=>saveProcurement({...inputOf(current),workflow:{state:'closed',events:[],packets:[]}},current.id,current.version)).toThrow(/ขั้นตอน/);
 expect(()=>saveProcurement({...inputOf(current),tasks:[{id:'a',title:'a',due:'2026-11-15',owner:'',dependsOn:['a'],done:false}]},current.id,current.version)).toThrow(/วนกลับ/);
 const hash=await documentContentHash(current,'D07'),same=procurementSchema.parse({...inputOf(current),notes:'เปลี่ยนหมายเหตุ',documents:{...current.documents,D07:{...current.documents.D07!,primaryFileId:'some-file'}}});expect(await documentContentHash(same,'D07')).toBe(hash);same.common.vendor='ร้านใหม่';expect(await documentContentHash(same,'D07')).not.toBe(hash);
 const other=saveProcurement({...await sample(),title:'อีกงาน'}),fileId=await attachProcurementFile(other.id,other.version,Buffer.from('%PDF-1.7\nevidence'),'other.pdf',{code:'OTHER',origin:'vendor',caseVersion:null});await expect(transitionProcurement(current.id,current.version,{action:'send_debt',date:'2026-11-15',actor:'ทดสอบ',note:'',receiptNumber:'',evidence:[fileId],requestId:randomUUID()})).rejects.toThrow(/ไม่อยู่ในงาน/);
});
it('compares edited Word paragraphs including textboxes without silently replacing bill items',async()=>{
 const current=saveProcurement(await sample()),result=await generateProcurementSuite(current.id,current.version),base=readProcurementFile(result.ids.D08),zip=await JSZip.loadAsync(base.bytes);const xml=await zip.file('word/document.xml')!.async('string');zip.file('word/document.xml',xml.replace('ประกาศ','ประกาศแก้ไข'));const changed=await zip.generateAsync({type:'nodebuffer'}),diff=await compareProcurementWord(current.id,result.ids.D08,changed,'edited.docx');expect(diff.diffs.length).toBeGreaterThan(0);expect(diff.diffs[0].after).toContain('แก้ไข');
 expect(readProcurementFile(diff.importedFileId).bytes.equals(changed)).toBe(true);
 zip.file('word/document.xml',xml.replace('<w:sectPr','<w:p><w:r><w:t>เพิ่มย่อหน้าทดสอบ</w:t></w:r></w:p><w:sectPr'));const structural=await compareProcurementWord(current.id,result.ids.D08,await zip.generateAsync({type:'nodebuffer'}),'structure.docx');expect(structural.structural).toBe(true);expect(structural.diffs).toHaveLength(0);expect(procurementSnapshot().files.find(file=>file.id===structural.importedFileId)?.meta.baseFileId).toBe(result.ids.D08);
},60000);
it('invalidates only documents whose printed content changes and ignores ZIP compression metadata',async()=>{
 const data=await sample(),before01=await documentContentHash(data,'D01'),before07=await documentContentHash(data,'D07'),before11=await documentContentHash(data,'D11');data.common.inspectionDate='2026-11-16';expect(await documentContentHash(data,'D01')).toBe(before01);expect(await documentContentHash(data,'D07')).toBe(before07);expect(await documentContentHash(data,'D11')).not.toBe(before11);
 const bytes=await buildLivePreview(data,'D11'),zip=await JSZip.loadAsync(bytes),repacked=await zip.generateAsync({type:'nodebuffer',compression:'STORE'});expect(createHash('sha256').update(bytes).digest('hex')).not.toBe(createHash('sha256').update(repacked).digest('hex'));expect(await wordContentHash(bytes)).toBe(await wordContentHash(repacked));
},30000);
it('does not inherit old inspection ticks and validates central bill controls',async()=>{
 const data=await sample();data.inspection={result:'pending',penalty:'pending',notes:''};const zip=await JSZip.loadAsync(await buildLivePreview(data,'D11')),xml=await zip.file('word/document.xml')!.async('string');expect(xml.match(/w:char="F052"/g)||[]).toHaveLength(0);expect(xml.match(/w:char="F0A3"/g)).toHaveLength(5);expect(billSchema.safeParse({...data.bill,items:[...data.bill.items,data.bill.items[0]]}).success).toBe(false);expect(bahtWords(100000100n)).toBe('หนึ่งล้านเอ็ดบาทถ้วน');
});

});
