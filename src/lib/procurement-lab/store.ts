import "server-only";
import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {createHash,randomUUID} from "node:crypto";
import {z} from "zod";
import {labDocumentSchema,sampleDocument,mergeFields,type LabDocument,type SavedLabDocument,type SourceFile,type FieldValues,type FieldDiff,type MergeChoice} from "./model";

export const LAB_MARKER="SARABUN_PROCUREMENT_LAB_V1";
export function labRoot(){
  if(process.env.SARABUN_PROCUREMENT_LAB!=="true")throw Error("PROCUREMENT_LAB_DISABLED");
  const requested=process.env.SARABUN_PROCUREMENT_LAB_ROOT;
  if(!requested||!path.isAbsolute(requested))throw Error("PROCUREMENT_LAB_DISABLED");
  const root=fs.realpathSync(requested),marker=path.join(root,"SAFETY-TEST-ONLY");
  if(!fs.existsSync(marker)||fs.readFileSync(marker,"utf8").trim()!==LAB_MARKER)throw Error("PROCUREMENT_LAB_DISABLED");
  if(path.parse(root).root===root)throw Error("PROCUREMENT_LAB_DISABLED");
  return root;
}
const globalLab=globalThis as unknown as {sarabunProcurementLab?:{file:string;db:DatabaseSync}};
export function labDb(){
  const file=path.join(labRoot(),"procurement-lab.sqlite");
  if(globalLab.sarabunProcurementLab?.file===file)return globalLab.sarabunProcurementLab.db;
  globalLab.sarabunProcurementLab?.db.close();
  const c=new DatabaseSync(file);c.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;");
  c.exec(`CREATE TABLE IF NOT EXISTS lab_documents(id TEXT PRIMARY KEY,version INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lab_revisions(document_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,reason TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(document_id,version));
    CREATE TABLE IF NOT EXISTS lab_files(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,sha256 TEXT NOT NULL,file BLOB NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lab_exports(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,version INTEGER NOT NULL,base TEXT NOT NULL,base_hash TEXT NOT NULL,outside_text TEXT NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lab_reviews(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,export_id TEXT NOT NULL,ours_version INTEGER NOT NULL,payload TEXT NOT NULL,name TEXT NOT NULL,file BLOB NOT NULL,sha256 TEXT NOT NULL,applied_version INTEGER,created_at TEXT NOT NULL); `);
  globalLab.sarabunProcurementLab={file,db:c};return c;
}
export function closeLabDb(){globalLab.sarabunProcurementLab?.db.close();delete globalLab.sarabunProcurementLab;}
const id=(v:string)=>z.string().uuid().parse(v);
const version=(v:number)=>z.number().int().positive().parse(v);
export const hashBytes=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
export const hashFields=(fields:FieldValues)=>hashBytes(JSON.stringify(Object.fromEntries(Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)))));
function transaction<T>(fn:(c:DatabaseSync)=>T){const c=labDb();c.exec("BEGIN IMMEDIATE");try{const result=fn(c);c.exec("COMMIT");return result;}catch(e){c.exec("ROLLBACK");throw e;}}
export function readLabDocument(documentId:string):SavedLabDocument{
  const r=labDb().prepare("SELECT * FROM lab_documents WHERE id=?").get(id(documentId));if(!r)throw Error("ไม่พบเอกสารทดลอง");
  return {id:String(r.id),version:Number(r.version),data:labDocumentSchema.parse(JSON.parse(String(r.data))),updatedAt:String(r.updated_at)};
}
export function listLabDocuments(){return labDb().prepare("SELECT id,version,updated_at,json_extract(data,'$.subject') subject FROM lab_documents ORDER BY updated_at DESC").all().map(r=>({id:String(r.id),version:Number(r.version),subject:String(r.subject),updatedAt:String(r.updated_at)}));}
export function createLabSample(scenario:"short"|"long"|"longer"="short"){
  return transaction(c=>{const key=randomUUID(),now=new Date().toISOString(),data=JSON.stringify(sampleDocument(scenario));c.prepare("INSERT INTO lab_documents VALUES(?,1,?,?)").run(key,data,now);c.prepare("INSERT INTO lab_revisions VALUES(?,1,?,?,?)").run(key,data,"สร้างข้อมูลจำลอง "+scenario,now);return readLabDocument(key);});
}
export function initialLabDocument(){const first=listLabDocuments()[0];return first?readLabDocument(first.id):createLabSample();}
function persist(c:DatabaseSync,documentId:string,expected:number,data:LabDocument,reason:string){
  const old=readLabDocument(documentId);if(old.version!==version(expected))throw Error("ข้อมูลเปลี่ยนจากอีกหน้าต่างแล้ว กรุณาโหลดฉบับล่าสุด");
  if(data.selectedSourceId&&!c.prepare("SELECT id FROM lab_files WHERE id=? AND document_id=?").get(data.selectedSourceId,documentId))throw Error("ไฟล์อ้างอิงไม่ใช่ของเอกสารนี้");
  const now=new Date().toISOString(),json=JSON.stringify(data);
  if(!c.prepare("UPDATE lab_documents SET version=version+1,data=?,updated_at=? WHERE id=? AND version=?").run(json,now,documentId,expected).changes)throw Error("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุด");
  c.prepare("INSERT INTO lab_revisions VALUES(?,?,?,?,?)").run(documentId,expected+1,json,reason,now);return readLabDocument(documentId);
}
export function saveLabDocument(documentId:string,expected:number,input:unknown){const data=labDocumentSchema.parse(input);return transaction(c=>persist(c,id(documentId),expected,data,"บันทึกร่าง / โหมดใช้งาน"));}
export function labSourceFiles(documentId:string):SourceFile[]{readLabDocument(documentId);return labDb().prepare("SELECT id,name,mime,length(file) bytes,sha256,created_at,text FROM lab_files WHERE document_id=? ORDER BY created_at DESC").all(documentId).map(r=>({id:String(r.id),name:String(r.name),mime:String(r.mime),bytes:Number(r.bytes),sha256:String(r.sha256),createdAt:String(r.created_at),text:String(r.text)}));}
export function addLabSource(documentId:string,input:{id:string;name:string;mime:string;bytes:Buffer;text:string}){
  readLabDocument(documentId);id(input.id);
  const digest=hashBytes(input.bytes);
  transaction(c=>{
    const old=c.prepare("SELECT document_id,sha256,name,mime FROM lab_files WHERE id=?").get(input.id);
    if(old){if(old.document_id!==documentId||old.sha256!==digest||old.name!==input.name||old.mime!==input.mime)throw Error("รหัสคำขอนี้ใช้กับไฟล์อื่นแล้ว");return;}
    if(Number(c.prepare("SELECT count(*) n FROM lab_files WHERE document_id=?").get(documentId)!.n)>=30)throw Error("ห้องทดลองรองรับไฟล์อ้างอิงไม่เกิน 30 ไฟล์ต่อเรื่อง");
    c.prepare("INSERT INTO lab_files VALUES(?,?,?,?,?,?,?,?)").run(input.id,documentId,input.name,input.mime,digest,input.bytes,input.text,new Date().toISOString());
  });
  return labSourceFiles(documentId);
}
export type ExportBaseline={id:string;documentId:string;version:number;base:FieldValues;baseHash:string;outsideText:string[]};
export function readLabExport(exportId:string):ExportBaseline{
  const r=labDb().prepare("SELECT * FROM lab_exports WHERE id=?").get(id(exportId));if(!r)throw Error("ไม่พบฉบับฐานที่เคยส่งออก จึงยังเทียบสามรุ่นไม่ได้");
  return {id:String(r.id),documentId:String(r.document_id),version:Number(r.version),base:JSON.parse(String(r.base)),baseHash:String(r.base_hash),outsideText:JSON.parse(String(r.outside_text))};
}
export function recordLabExport(input:ExportBaseline,bytes:Buffer){
  transaction(c=>{const current=readLabDocument(input.documentId);if(current.version!==input.version)throw Error("ร่างเปลี่ยนระหว่างสร้าง Word กรุณาส่งออกฉบับล่าสุด");c.prepare("INSERT INTO lab_exports VALUES(?,?,?,?,?,?,?,?)").run(input.id,input.documentId,input.version,JSON.stringify(input.base),input.baseHash,JSON.stringify(input.outsideText),bytes,new Date().toISOString());});
}
export type LabReview={id:string;documentId:string;exportId:string;oursVersion:number;exportVersion:number;diffs:FieldDiff[];unmapped:string[];warnings:string[];name:string;appliedVersion:number|null};
export function createLabReview(documentId:string,input:Omit<LabReview,"id"|"documentId"|"appliedVersion">,file:Buffer,requestId:string){
  id(requestId);const digest=hashBytes(file);
  return transaction(c=>{
    const old=c.prepare("SELECT document_id,sha256 FROM lab_reviews WHERE id=?").get(requestId);
    if(old){if(old.document_id!==documentId||old.sha256!==digest)throw Error("รหัสคำขอนำกลับใช้กับไฟล์อื่นแล้ว");return readLabReview(requestId);}
    if(readLabDocument(documentId).version!==input.oursVersion)throw Error("ร่างเปลี่ยนระหว่างอ่านไฟล์ กรุณาเทียบใหม่");
    const baseline=readLabExport(input.exportId);if(baseline.documentId!==documentId)throw Error("Word นี้เป็นของเอกสารทดลองอีกฉบับ");
    c.prepare("INSERT INTO lab_reviews VALUES(?,?,?,?,?,?,?,?,?,?)").run(requestId,documentId,input.exportId,input.oursVersion,JSON.stringify(input),input.name,file,digest,null,new Date().toISOString());
    return readLabReview(requestId);
  });
}
export function readLabReview(reviewId:string):LabReview{
  const r=labDb().prepare("SELECT * FROM lab_reviews WHERE id=?").get(id(reviewId));if(!r)throw Error("ไม่พบรายการเทียบ Word");
  return {...JSON.parse(String(r.payload)),id:String(r.id),documentId:String(r.document_id),appliedVersion:r.applied_version===null?null:Number(r.applied_version)};
}
export function applyLabReview(documentId:string,reviewId:string,choices:Record<string,MergeChoice>,acknowledgeUnmapped:boolean){
  return transaction(c=>{
    const review=readLabReview(reviewId);if(review.documentId!==documentId)throw Error("รายการเทียบไม่ใช่ของเอกสารนี้");
    if(review.appliedVersion!==null)return {document:readLabDocument(documentId),alreadyApplied:true,appliedVersion:review.appliedVersion};
    const current=readLabDocument(documentId);if(current.version!==review.oursVersion)throw Error("มีการแก้ไขหลังเปิดหน้าความต่าง กรุณาเทียบ Word ใหม่ก่อนนำกลับ");
    if(review.unmapped.length&&!acknowledgeUnmapped)throw Error("ตรวจส่วนที่ยังไม่ได้รวมและยืนยันวิธีเก็บไว้ก่อน");
    const data=mergeFields(current.data,review.diffs,choices),saved=persist(c,documentId,current.version,data,"รวม Word จาก "+review.exportId);
    c.prepare("UPDATE lab_reviews SET applied_version=?,payload=? WHERE id=?").run(saved.version,JSON.stringify({...review,choices,acknowledgeUnmapped}),reviewId);
    return {document:saved,alreadyApplied:false,appliedVersion:saved.version};
  });
}
export function readLabBinary(fileId:string){
  const key=id(fileId),c=labDb();let r=c.prepare("SELECT document_id,name,mime,file FROM lab_files WHERE id=?").get(key);
  if(!r)r=c.prepare("SELECT document_id,name,'application/vnd.openxmlformats-officedocument.wordprocessingml.document' mime,file FROM lab_reviews WHERE id=?").get(key);
  if(!r)r=c.prepare("SELECT document_id,'D07-export.docx' name,'application/vnd.openxmlformats-officedocument.wordprocessingml.document' mime,file FROM lab_exports WHERE id=?").get(key);
  if(!r)throw Error("ไม่พบไฟล์ในห้องทดลอง");readLabDocument(String(r.document_id));return {documentId:String(r.document_id),name:String(r.name),mime:String(r.mime),bytes:Buffer.from(r.file as Uint8Array)};
}
