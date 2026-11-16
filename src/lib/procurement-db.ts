import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import {db} from './db';
import {procurementSql,procurementSchema,procurementFileSchema,d07Values,d07Missing,d01Values,d01Missing,type ProcurementCase,type ProcurementFile,type ProcurementSnapshot} from './procurement';
import {fillD07Template,linkContinuationFooter,wordContentHash} from './procurement-template';
import {nativeD07Pdf} from './procurement-preview';
import {documentTemplates,type DraftDocumentCode} from './procurement-documents';
import {fillD01Template} from './procurement-d01-template';
import {suiteMissing,finishSuiteDocument} from './procurement-suite';
import {caseContentStamp,validateContractTasks} from './procurement-process';
import {billTotals} from './procurement-bill';
import {suiteCodes,emptyDocumentConfig} from './procurement-workflow-model';
import {procurementFilename} from './procurement-filenames';

const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export class ProcurementConflict extends Error{}
function connection(){const c=db();for(const [name,sql] of Object.entries(procurementSql))c.exec(`CREATE TABLE IF NOT EXISTS ${name} (${sql})`);return c;}
function audit(id:string,action:string,version:number|null){connection().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,action,version,new Date().toISOString());}
function caseRow(row:Record<string,unknown>):ProcurementCase{return {...procurementSchema.parse(JSON.parse(String(row.data))),id:String(row.id),version:Number(row.version),updatedAt:String(row.updated_at)};}
export function readProcurement(id:string){const row=connection().prepare('SELECT * FROM procurement_cases WHERE id=?').get(id);if(!row)throw Error('ไม่พบงานจัดซื้อจัดจ้าง');return caseRow(row);}
export function procurementSnapshot():ProcurementSnapshot{
 const c=connection(),template=c.prepare('SELECT name,sha256 FROM procurement_templates WHERE id=?').get('D07');
 const cases=c.prepare('SELECT * FROM procurement_cases ORDER BY updated_at DESC,id').all().map(caseRow).sort((a,b)=>(a.contractDue||'9999').localeCompare(b.contractDue||'9999'));
 const files=c.prepare('SELECT id,case_id,name,mime,sha256,data,created_at,length(file) bytes FROM procurement_files ORDER BY created_at DESC,id').all().map(row=>({id:String(row.id),caseId:String(row.case_id),name:String(row.name),mime:String(row.mime),sha256:String(row.sha256),bytes:Number(row.bytes),createdAt:String(row.created_at),meta:procurementFileSchema.parse(JSON.parse(String(row.data)))}));
 const templates=Object.fromEntries(Object.keys(documentTemplates).map(code=>{const row=c.prepare('SELECT name,sha256 FROM procurement_templates WHERE id=?').get(code);return [code,row?{ready:true,name:String(row.name),sha256:String(row.sha256)}:{ready:false}];})) as NonNullable<ProcurementSnapshot['templates']>;
 return {cases,files,template:template?{ready:true,name:String(template.name),sha256:String(template.sha256)}:{ready:false},templates};
}
export function saveProcurement(input:unknown,id?:string,version?:number,workflowChange=false){
 const data=procurementSchema.parse(input),c=connection(),caseId=id||randomUUID(),at=new Date().toISOString();
 validateContractTasks(data);
 if(data.bill.items.length&&billTotals(data.bill).total>99999999999n)throw Error('ยอดเงินสูงเกินขอบเขตแม่แบบ 999,999,999.99 บาท');
 const oldWorkflow=id?readProcurement(id).workflow:{state:'preparing',events:[],packets:[]};
 if(!workflowChange&&JSON.stringify(data.workflow)!==JSON.stringify(oldWorkflow))throw Error('เปลี่ยนขั้นตอนผ่านปุ่มดำเนินการเพื่อเก็บหลักฐานเท่านั้น');
 if(id&&!workflowChange&&oldWorkflow.state!=='preparing'&&caseContentStamp(data,oldWorkflow.state==='closed')!==caseContentStamp(readProcurement(id),oldWorkflow.state==='closed'))throw Error('เอกสารส่งคลังหรือปิดแล้ว เปิดแก้ไขพร้อมเหตุผลในส่วนส่งคลังก่อนแก้ข้อมูลบิล');
 if(!id&&version!==undefined)throw Error('เวอร์ชันงานไม่ถูกต้อง');
 c.transaction(()=>{
  const old=c.prepare('SELECT version FROM procurement_cases WHERE id=?').get(caseId);
  if(id&&(!old||old.version!==version))throw new ProcurementConflict('งานนี้เปลี่ยนจากอีกหน้าต่างแล้ว กรุณาเปิดฉบับล่าสุดก่อนบันทึก');
  const next=Number(old?.version||0)+1,json=JSON.stringify(data);
  if(old)c.prepare('UPDATE procurement_cases SET data=?,version=?,updated_at=? WHERE id=?').run(json,next,at,caseId);
  else c.prepare('INSERT INTO procurement_cases VALUES(?,?,?,?)').run(caseId,json,next,at);
  c.prepare('INSERT INTO procurement_revisions VALUES(?,?,?,?,?)').run(randomUUID(),caseId,json,next,at);
  audit(caseId,'procurement_save',next);
 })();return readProcurement(caseId);
}
export function procurementHistory(id:string){readProcurement(id);return connection().prepare('SELECT version,updated_at FROM procurement_revisions WHERE case_id=? ORDER BY version DESC').all(id).map(row=>({version:Number(row.version),at:String(row.updated_at)}));}
export function installProcurementTemplate(bytes:Buffer,name:string,code:DraftDocumentCode='D07'){
 if(digest(bytes)!==documentTemplates[code].sha256)throw Error('ไฟล์นี้ไม่ตรงต้นฉบับ '+code+' ที่ตรวจไว้ กรุณาเลือกฉบับเดิม');
 const c=connection();c.transaction(()=>{c.prepare('INSERT OR IGNORE INTO procurement_templates VALUES(?,?,?,?,?)').run(code,safeName(name),documentTemplates[code].sha256,bytes,new Date().toISOString());audit(code,'procurement_template_install',null);})();
}
export function procurementTemplateBytes(code:DraftDocumentCode){const row=connection().prepare('SELECT file,sha256 FROM procurement_templates WHERE id=?').get(code);if(!row||row.sha256!==documentTemplates[code].sha256)throw Error('ยังไม่ได้ติดตั้งแม่แบบ '+code);return Buffer.from(row.file as Uint8Array);}
const DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function safeName(name:string){if(!name||name.length>200||/[\\/\x00-\x1f\x7f]/.test(name)||name==='.'||name==='..')throw Error('ชื่อไฟล์ไม่ถูกต้อง');return name;}
export async function validateProcurementUpload(bytes:Buffer,name:string){
 safeName(name);if(!bytes.length||bytes.length>20*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 20 MB');
 const ext=name.toLowerCase().split('.').at(-1);
 if(ext==='pdf'&&bytes.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(ext==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(['jpg','jpeg'].includes(ext||'')&&bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';
 if(ext==='docx'){
  const zip=await JSZip.loadAsync(bytes),entries=Object.values(zip.files) as unknown as {dir:boolean;_data?:{uncompressedSize?:number}}[];if(entries.length>500||entries.reduce((sum,entry)=>sum+(entry._data?.uncompressedSize||0),0)>80*1024*1024)throw Error('โครงสร้าง Word ใหญ่เกินขอบเขตที่รองรับ');
  if(zip.file('word/document.xml')&&zip.file('[Content_Types].xml')&&!zip.file('word/vbaProject.bin'))return DOCX;
 }
 throw Error('รองรับเฉพาะไฟล์ PDF, DOCX, PNG และ JPG ที่มีชนิดไฟล์ตรงกับชื่อ');
}
function insertFile(id:string,bytes:Buffer,name:string,mime:string,meta:ProcurementFile['meta']){
 const c=connection(),fileId=randomUUID();c.prepare('INSERT INTO procurement_files VALUES(?,?,?,?,?,?,?,?)').run(fileId,id,safeName(name),mime,digest(bytes),bytes,JSON.stringify(procurementFileSchema.parse(meta)),new Date().toISOString());return fileId;
}
export async function attachProcurementFile(id:string,version:number,bytes:Buffer,name:string,input:unknown){
 const mime=await validateProcurementUpload(bytes,name),meta=procurementFileSchema.parse(input);
 if(meta.origin==='draft'||meta.caseVersion!==null||meta.values||meta.outputVersion||meta.templateHash||meta.contentHash)throw Error('ไฟล์นำเข้าให้เก็บเป็นหลักฐานต้นฉบับ ไม่ใช่ฉบับร่างที่ระบบสร้าง');
 if(meta.baseFileId){const base=connection().prepare('SELECT case_id,data FROM procurement_files WHERE id=?').get(meta.baseFileId);if(meta.origin!=='word'||!base||base.case_id!==id||procurementFileSchema.parse(JSON.parse(String(base.data))).code!==meta.code)throw Error('Word ต้นทางไม่อยู่ในฉบับและงานเดียวกัน');}
 let fileId='';connection().transaction(()=>{const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('งานเปลี่ยนแล้ว กรุณาเปิดฉบับล่าสุดก่อนแนบไฟล์');fileId=insertFile(id,bytes,name,mime,{...meta,documentType:current.documentTypes[meta.code]});audit(id,'procurement_attach',version);})();return fileId;
}
async function buildDocument(current:ProcurementCase,code:DraftDocumentCode){
 if(Object.hasOwn(current.sources,code)&&current.sources[code as keyof typeof current.sources]!=='draft')throw Error('เลือกใช้ฉบับร่างเองสำหรับ '+code+' ก่อนสร้าง Word');
 const missing=[...(code==='D01'?d01Missing(current):code==='D07'?d07Missing(current):[]),...await suiteMissing(current,code)];if(missing.length)throw Error('กรอกข้อมูล '+code+' ให้ครบ: '+missing.join(', '));
 const values=code==='D01'?d01Values(current):code==='D07'?d07Values(current):{};if(Object.values(values).some(value=>value.includes('{{')||value.includes('}}')))throw Error('ตรวจข้อมูลที่ตัวแปรในข้อความอ้างถึงให้ครบก่อนสร้างเอกสาร');
 const reference=procurementTemplateBytes(code),base=code==='D01'?await fillD01Template(values,reference):code==='D07'?await fillD07Template(values,reference):{bytes:reference};
 const built=await finishSuiteDocument(base.bytes,current,code);
 // The content key follows source data; page-specific footer fields are derived decoration.
 const contentHash=await wordContentHash(built.bytes),final=await (await import('./procurement-preview')).finalizeProcurementWord(built.bytes);
 return {bytes:final.word,meta:{code,origin:'draft' as const,caseVersion:current.version,documentType:current.documentTypes[code],templateHash:built.sourceHash,values:{...built.values,...values},contentHash,outputVersion:documentTemplates[code].outputVersion}};
}
export async function generateProcurementDocument(id:string,version:number,code:DraftDocumentCode='D07'){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว กรุณาเปิดฉบับล่าสุดก่อนสร้างเอกสาร');
 const built=await buildDocument(current,code);
 let fileId='';connection().transaction(()=>{
  if(readProcurement(id).version!==version)throw new ProcurementConflict('มีการแก้ข้อมูลระหว่างสร้างเอกสาร กรุณาสร้างจากฉบับล่าสุด');
  fileId=insertFile(id,built.bytes,procurementFilename(current,built.meta.values.subject||documentTemplates[code].name,version,'docx'),DOCX,built.meta);audit(id,'procurement_generate_'+code.toLowerCase(),version);
 })();return fileId;
}
export async function generateProcurementSuite(id:string,version:number){
 const current=readProcurement(id);if(current.version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนสร้างทั้งชุด');
 if(current.workflow.state!=='preparing')throw Error('ชุดเรื่องส่งคลังแล้ว ใช้ชุดที่ตรึงไว้ หรือเปิดแก้ไขพร้อมเหตุผลก่อนสร้างชุดใหม่');
 const selected=suiteCodes.filter(code=>current.documents[code]?.required!==false&&(!Object.hasOwn(current.sources,code)||current.sources[code as keyof typeof current.sources]==='draft'));
 const built:({code:DraftDocumentCode}&Awaited<ReturnType<typeof buildDocument>>)[]=[];for(const code of selected)built.push({code,...await buildDocument(current,code)});
 const ids:Record<string,string>={},documents={...current.documents};
 connection().transaction(()=>{
  if(readProcurement(id).version!==version)throw new ProcurementConflict('ข้อมูลเปลี่ยนระหว่างสร้างทั้งชุด กรุณาลองใหม่');
  for(const item of built){const fileId=insertFile(id,item.bytes,procurementFilename(current,item.meta.values.subject||documentTemplates[item.code].name,version,'docx'),DOCX,item.meta);ids[item.code]=fileId;documents[item.code]={...(documents[item.code]||emptyDocumentConfig()),primaryFileId:fileId,reviewedHash:'',signatureChecked:false,signedFileId:''};}
  const {id:_id,version:_version,updatedAt:_at,...data}=current,json=JSON.stringify(procurementSchema.parse({...data,documents})),at=new Date().toISOString(),next=version+1;
  connection().prepare('UPDATE procurement_cases SET data=?,version=?,updated_at=? WHERE id=?').run(json,next,at,id);
  connection().prepare('INSERT INTO procurement_revisions VALUES(?,?,?,?,?)').run(randomUUID(),id,json,next,at);audit(id,'procurement_generate_suite',next);
 })();return {ids,record:readProcurement(id)};
}
export const generateProcurementD07=(id:string,version:number)=>generateProcurementDocument(id,version,'D07');
export function readProcurementFile(id:string){const row=connection().prepare('SELECT * FROM procurement_files WHERE id=?').get(id);if(!row)throw Error('ไม่พบไฟล์');readProcurement(String(row.case_id));const bytes=Buffer.from(row.file as Uint8Array);if(digest(bytes)!==row.sha256)throw Error('ไฟล์ไม่ตรงกับหลักฐานที่เก็บไว้');return {bytes,name:String(row.name),mime:String(row.mime),caseId:String(row.case_id)};}
export async function previewProcurementD07(fileId:string){
 const row=connection().prepare('SELECT data FROM procurement_files WHERE id=?').get(fileId);if(!row)throw Error('ไม่พบเอกสาร');
 const meta=procurementFileSchema.parse(JSON.parse(String(row.data))),file=readProcurementFile(fileId);
 const template=documentTemplates[meta.code as DraftDocumentCode];
 if(file.mime!==DOCX||!template||meta.origin!=='draft'||meta.templateHash!==template.sha256||!meta.values)throw Error('สร้างตัวอย่างได้เฉพาะ Word ที่ระบบสร้างจากแม่แบบที่ตรวจไว้');
 const preview=await nativeD07Pdf(file.bytes);
 // Native Word retains source pagination. Multi-page files remain drafts for human review.
 let id='';connection().transaction(()=>{readProcurement(file.caseId);id=insertFile(file.caseId,preview.bytes,file.name.replace(/\.docx$/i,'.pdf'),'application/pdf',meta);audit(file.caseId,'procurement_preview_d07',meta.caseVersion);})();return {id,pages:preview.pages};
}
