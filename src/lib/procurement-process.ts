import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {readProcurement,procurementSnapshot,saveProcurement,ProcurementConflict} from './procurement-db';
import {processActionSchema,suiteCodes,emptyDocumentConfig,type financeStates} from './procurement-workflow-model';
import {procurementDocumentNames,type ProcurementDocumentCode} from './procurement-document-types';
import {procurementCodes,type ProcurementInput,type ProcurementCase,type ProcurementFile} from './procurement';
import {documentTemplates,type DraftDocumentCode} from './procurement-documents';
import {buildLivePreview} from './procurement-live-preview';
import {billValues} from './procurement-bill';
import {wordContentHash} from './procurement-template';
const inputOf=({id:_id,version:_version,updatedAt:_at,...data}:ProcurementCase)=>data;
export async function documentContentHash(data:ProcurementInput,code:string){
 if(Object.hasOwn(documentTemplates,code))try{return wordContentHash(await buildLivePreview(data,code as DraftDocumentCode));}catch(error){if(data.sources[code as keyof typeof data.sources]!=='external'||!(error instanceof Error)||!error.message.startsWith('ยังไม่ได้ติดตั้ง'))throw error;}
 const common=billValues(data),values=Object.fromEntries(['vendor','vendorTaxId','vendorAddress','item','agreed','offered','orderNumber','orderDate','egpNumber','organization'].map(key=>[key,common[key]||'']));
 return createHash('sha256').update(JSON.stringify({kind:data.kind,bill:data.bill,contractDue:data.contractDue,values})).digest('hex');
}
export function caseContentStamp(data:ProcurementInput,includeVoucher=true){return JSON.stringify({kind:data.kind,profile:data.profile,common:data.common,bill:data.bill,contractDue:data.contractDue,inspection:data.inspection,d01:data.d01,d01Overrides:data.d01Overrides,d07Overrides:data.d07Overrides,documents:procurementCodes.filter(code=>includeVoucher||code!=='V01').map(code=>({code,number:data.documents[code]?.number||'',date:data.documents[code]?.date||'',subject:data.documents[code]?.subject||'',paragraphs:data.documents[code]?.paragraphs||{}}))});}
export function validateContractTasks(data:ProcurementInput){
 const ids=new Set(data.tasks.map(t=>t.id));if(ids.size!==data.tasks.length)throw Error('รหัสงานสัญญาซ้ำ');
 const seen=new Set<string>(),visiting=new Set<string>();
 const visit=(id:string)=>{if(visiting.has(id))throw Error('งานก่อนหน้าวนกลับมาหากัน');if(seen.has(id))return;visiting.add(id);const task=data.tasks.find(t=>t.id===id)!;for(const previous of task.dependsOn){if(!ids.has(previous))throw Error('ไม่พบงานที่ต้องทำก่อน');visit(previous);if(task.done&&!data.tasks.find(t=>t.id===previous)!.done)throw Error('ยังมีงานก่อนหน้าที่ทำไม่เสร็จ');}visiting.delete(id);seen.add(id);};
 for(const id of ids)visit(id);
}
const needsSignature=(code:string)=>!['D10','E01','P01','OTHER'].includes(code);
export async function documentChecklist(data:ProcurementInput,files:ProcurementFile[],round=1){
 const codes:ProcurementDocumentCode[]=round===2?['V01']:[...suiteCodes,'E01'];
 return Promise.all(codes.map(async code=>{const config=data.documents[code]||emptyDocumentConfig(),primary=files.find(f=>f.id===config.primaryFileId&&f.meta.code===code),signed=files.find(f=>f.id===config.signedFileId&&f.meta.code===code&&f.meta.origin==='scan');let reason='';const hash=primary?await documentContentHash(data,code):'';
 if(!config.required&&code!=='V01')reason=config.exemptionReason.trim()?'':'ระบุเหตุที่ไม่ใช้เอกสารนี้';
 else if(!primary)reason='เลือกฉบับใช้งาน';
 else if(['E01','V01'].includes(code)&&primary.meta.origin!=='elaas')reason='เลือกไฟล์ต้นทางที่ได้จาก e-LAAS';
 else if(Object.hasOwn(data.sources,code)&&data.sources[code as keyof typeof data.sources]==='external'&&primary.meta.origin!=='egp')reason='เลือกไฟล์ต้นทางจาก e-GP ให้ตรงแหล่งที่เลือก';
 else if(Object.hasOwn(data.sources,code)&&(data.sources[code as keyof typeof data.sources]==='draft')!==(primary.meta.origin==='draft'||primary.meta.origin==='word'&&!!primary.meta.baseFileId))reason='ฉบับใช้งานไม่ตรงแหล่งเอกสารที่เลือก';
 else if(primary.meta.origin==='draft'&&primary.meta.contentHash!==hash)reason='ข้อมูลกลางเปลี่ยน ต้องสร้างฉบับใหม่';
 else if(config.reviewedHash!==hash)reason=primary.meta.origin==='word'?'Word ภายนอกไม่ปรับตามข้อมูลกลาง ต้องเทียบและตรวจฉบับนี้ใหม่':'ตรวจทานฉบับปัจจุบัน';
 else if(needsSignature(code)&&(!signed||!config.signatureChecked))reason='แนบสแกนและยืนยันตรวจลายเซ็น';
 return {code,name:procurementDocumentNames[code],ready:!reason,reason,exempt:!config.required&&code!=='V01',file:needsSignature(code)?signed:primary,primary,copies:config.copies};}));
}
export async function reviewProcurementDocument(id:string,version:number,input:unknown){
 const {code}=z.object({code:z.enum([...suiteCodes,'E01','V01','P01','OTHER'])}).strict().parse(input),current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('งานเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนตรวจทาน');
 const config=current.documents[code]||emptyDocumentConfig(),files=procurementSnapshot().files.filter(f=>f.caseId===id),primary=files.find(f=>f.id===config.primaryFileId&&f.meta.code===code);
 if(!config.required&&code!=='V01'){if(!config.exemptionReason.trim())throw Error('ระบุเหตุผลที่ไม่ใช้เอกสารนี้ก่อน');return current;}
 if(config.required&&!primary)throw Error('เลือกไฟล์ฉบับใช้งานก่อนตรวจทาน');
 const hash=await documentContentHash(current,code);
 if(primary?.meta.origin==='draft'&&primary.meta.contentHash!==hash)throw Error('ข้อมูลกลางเปลี่ยนแล้ว สร้างเอกสารใหม่ก่อนตรวจทาน');
 return saveProcurement({...inputOf(current),documents:{...current.documents,[code]:{...config,reviewedHash:hash}}},id,version);
}
export async function transitionProcurement(id:string,version:number,input:unknown){
 const action=processActionSchema.parse(input),current=readProcurement(id);
 if(current.workflow.events.some(event=>event.id===action.requestId))return current;
 if(current.version!==version)throw new ProcurementConflict('งานเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนบันทึกขั้นตอน');
 const when=new Date(action.date+'T12:00:00+07:00');if(Number.isNaN(when.getTime())||when.toISOString().slice(0,10)!==action.date)throw Error('วันที่ไม่ถูกต้อง');
 if(action.date>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date()))throw Error('บันทึกการรับส่งจริงล่วงหน้าไม่ได้ ใช้งานสัญญาสำหรับวางแผน');
 const last=current.workflow.events.at(-1);if(last&&action.date<last.date)throw Error('วันเหตุการณ์ต้องไม่ก่อนขั้นตอนก่อนหน้า');
 const files=procurementSnapshot().files.filter(f=>f.caseId===id),state=current.workflow.state;
 for(const fileId of action.evidence)if(!files.some(file=>file.id===fileId))throw Error('หลักฐานไม่อยู่ในงานนี้');
 const allowed:Record<string,typeof financeStates[number]>={send_debt:'preparing',receive_debt:'debt_sent',return_for_voucher:'debt_received',send_voucher:'returned_for_voucher',receive_voucher:'voucher_sent'};
 if(action.action==='rework'){if(!['debt_sent','debt_received','voucher_sent'].includes(state)||!action.note.trim())throw Error('ระบุเหตุที่คลังตีกลับและเลือกสถานะส่งคลังที่เกี่ยวข้อง');}
 else if(action.action==='reopen'){if(!['closed','returned_for_voucher'].includes(state)||!action.note.trim())throw Error('เปิดแก้ไขได้เมื่อปิดงานหรือรับเอกสารกลับแล้ว พร้อมเหตุผล');}
 else if(state!==allowed[action.action])throw Error('ยังไม่ถึงขั้นตอนนี้ หรือได้ดำเนินการแล้ว');
 let to=state,packetId='',packets=[...current.workflow.packets];
 if(action.action==='send_debt'||action.action==='send_voucher'){
  if(action.action==='send_debt'&&(current.profile==='pending'||current.egpExemption==='pending'))throw Error('ยืนยันแนวทางจัดซื้อจัดจ้างและการดำเนินการ e-GP ในข้อมูลกลางก่อนส่งตั้งหนี้');
  if(action.action==='send_debt'&&current.tasks.some(task=>!task.done))throw Error('ยังมีงานตามสัญญาที่บันทึกไว้ว่ายังไม่เสร็จ');
  if(action.action==='send_debt'&&(current.inspection.result!=='complete'||current.inspection.penalty==='pending'))throw Error('บันทึกผลตรวจรับให้ครบตามข้อเท็จจริงก่อนส่งตั้งหนี้ทั้งบิล');
  const round=action.action==='send_debt'?1:2,checks=await documentChecklist(current,files,round),missing=checks.filter(item=>!item.ready);
  if(missing.length)throw Error('ชุดส่งยังไม่ครบ: '+missing.map(item=>item.code+' '+item.reason).join('; '));
  if(round===1&&!files.some(file=>file.meta.origin==='vendor'&&action.evidence.includes(file.id)))throw Error('เลือกเอกสารร้านค้าที่จะรวมในชุดส่งอย่างน้อยหนึ่งฉบับ');
  if(round===1&&current.egpExemption==='none'&&current.documents.D10?.required!==false&&!checks.some(item=>item.code==='D10'&&item.primary?.meta.origin==='egp')&&!files.some(file=>file.meta.code==='D10'&&file.meta.origin==='egp'&&action.evidence.includes(file.id)))throw Error('เลือกภาพหน้าจอหรือไฟล์ข้อมูลสาระสำคัญ e-GP ในหลักฐานชุดส่ง D10 ด้วย แบบร่างไม่แทนหลักฐานต้นทาง');
  const entries=checks.filter(item=>!item.exempt&&item.file).map(item=>({id:item.file!.id,sha256:item.file!.sha256,name:item.file!.name,code:item.code,copies:item.copies}));
  for(const file of files.filter(f=>action.evidence.includes(f.id)))if(!entries.some(e=>e.id===file.id))entries.push({id:file.id,sha256:file.sha256,name:file.name,code:file.meta.code,copies:1});
  packetId=randomUUID();packets.push({id:packetId,round,createdAt:new Date().toISOString(),caseVersion:version,files:entries});to=round===1?'debt_sent':'voucher_sent';
 }else if(action.action==='receive_debt'||action.action==='receive_voucher'){
  const round=action.action==='receive_debt'?1:2,packet=[...packets].reverse().find(p=>p.round===round);if(!packet)throw Error('ไม่พบชุดส่งที่คลังลงรับ');packetId=packet.id;to=round===1?'debt_received':'closed';
 }else if(action.action==='return_for_voucher')to='returned_for_voucher';
 else {packetId=[...packets].reverse().find(p=>p.round===(state==='voucher_sent'?2:1))?.id||'';to=state==='voucher_sent'?'returned_for_voucher':'preparing';}
 const event={id:action.requestId,action:action.action,date:action.date,actor:action.actor,note:action.note,receiptNumber:action.receiptNumber,evidence:action.evidence,packetId,from:state,to,at:new Date().toISOString()};
 return saveProcurement({...inputOf(current),workflow:{state:to,events:[...current.workflow.events,event],packets}},id,version,true);
}
