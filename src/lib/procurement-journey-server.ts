import 'server-only';
import {readProcurement,procurementSnapshot,generateProcurementDocument,attachProcurementFile,saveProcurement,ProcurementConflict} from './procurement-db';
import {documentChecklist,reviewProcurementDocument} from './procurement-process';
import {journeyProgress,procurementJourney,type ProcurementJourneyId} from './procurement-journey';
import {emptyDocumentConfig} from './procurement-workflow-model';
import type {DraftDocumentCode} from './procurement-documents';
import type {ProcurementCase} from './procurement';
import type {ProcurementDocumentCode} from './procurement-document-types';
import {assertProcurementDocumentEditable} from './procurement-editing';
const inputOf=({id:_id,version:_v,updatedAt:_at,...input}:ProcurementCase)=>input;
export async function procurementJourneyProgress(id:string){
 const data=readProcurement(id),files=procurementSnapshot().files.filter(f=>f.caseId===id),checks=[...await documentChecklist(data,files),...await documentChecklist(data,files,2)];return journeyProgress(data,checks);
}
export async function advanceProcurementJourney(id:string,version:number,stage:ProcurementJourneyId){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนดำเนินการ');
 const progress=await procurementJourneyProgress(id),check=progress.stages.find(s=>s.id===stage)!;
 if(check.blockedBy)throw Error('ทำขั้น '+procurementJourney.find(s=>s.id===check.blockedBy)!.title+' ให้เสร็จก่อน');
 if(!check.ready)throw Error(check.reason);
 const index=procurementJourney.findIndex(s=>s.id===stage);return {next:procurementJourney[Math.min(index+1,procurementJourney.length-1)].id,progress};
}
export async function reviewProcurementJourneyDocument(id:string,version:number,code:ProcurementDocumentCode){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนตรวจทาน');
 const progress=await procurementJourneyProgress(id),check=progress.stages.find(s=>s.id===code);
 if(!check)throw Error('ไม่พบเอกสารของขั้นนี้');
 if(check.blockedBy)throw Error('ทำขั้น '+procurementJourney.find(s=>s.id===check.blockedBy)!.title+' ให้เสร็จก่อนยืนยันขั้นนี้');
 if(['D14','V01'].includes(code)&&current.workflow.state!=='returned_for_voucher')throw Error('รอคลังส่งเอกสารกลับก่อนตรวจบันทึกขอเบิกและฎีกา');
 assertProcurementDocumentEditable(current,code);
 return reviewProcurementDocument(id,version,{code});
}
export async function prepareProcurementJourneyDocument(id:string,version:number,code:DraftDocumentCode){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนสร้างเอกสาร');
 assertProcurementDocumentEditable(current,code);
 const fileId=await generateProcurementDocument(id,version,code),config=current.documents[code]||emptyDocumentConfig();
 const record=saveProcurement({...inputOf(current),documents:{...current.documents,[code]:{...config,primaryFileId:fileId,reviewedHash:'',signedFileId:'',signatureChecked:false}}},id,version);return {record,fileId};
}
export async function attachProcurementJourneyFile(id:string,version:number,code:ProcurementDocumentCode,kind:'primary'|'signed',bytes:Buffer,name:string){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนแนบไฟล์');
 if(!procurementJourney.some(s=>'code'in s&&s.code===code))throw Error('หมวดนี้ไม่ใช่เอกสารของขั้นดำเนินงาน');
 if(code==='V01'&&current.workflow.state!=='returned_for_voucher')throw Error('รับเอกสารกลับจากคลังก่อนแนบฎีกาในขั้นนี้');
 assertProcurementDocumentEditable(current,code);
 if(code==='V01'&&!name.toLowerCase().endsWith('.pdf'))throw Error('ฎีกาในขั้นนี้ต้องเป็นไฟล์ PDF');
 if(kind==='signed'&&['D10','E01','L01','L02','P01'].includes(code))throw Error('ขั้นนี้ใช้ไฟล์ต้นทาง ไม่ใช่สแกนลงนาม');
 const external=Object.hasOwn(current.sources,code)&&current.sources[code as keyof typeof current.sources]==='external';
 if(kind==='primary'&&!external&&!['E01','V01','L01','L02','P01'].includes(code))throw Error('สร้างฉบับร่างจากข้อมูลกลาง หรือเลือกใช้ไฟล์ระบบก่อนแนบฉบับใช้งาน');
 const origin=kind==='signed'||code==='P01'?'scan':['E01','V01','L01','L02'].includes(code)?'elaas':'egp',fileId=await attachProcurementFile(id,version,bytes,name,{code,origin,caseVersion:null}),config=current.documents[code]||emptyDocumentConfig();
 const record=saveProcurement({...inputOf(current),documents:{...current.documents,[code]:{...config,...kind==='primary'?{primaryFileId:fileId,signedFileId:'',reviewedHash:''}:{signedFileId:fileId},signatureChecked:false}}},id,version);return {record,fileId};
}
