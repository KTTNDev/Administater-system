import "server-only";
import { randomUUID } from "node:crypto";
import { db, readDraft } from "./db";

export type SignedScan = { id:string; documentId:string; name:string; mime:string; bytes:number; uploadedAt:string };
type ScanRow={id:string;document_id:string;name:string;mime:string;bytes:number;uploaded_at:string;file:Uint8Array};

function metadata(row:ScanRow):SignedScan {
  return {id:row.id,documentId:row.document_id,name:row.name,mime:row.mime,bytes:row.bytes,uploadedAt:row.uploaded_at};
}
export function listSignedScans(documentId:string):SignedScan[] {
  readDraft(documentId);
  return (db().prepare("SELECT id,document_id,name,mime,bytes,uploaded_at FROM signed_scans WHERE document_id=? ORDER BY uploaded_at,id").all(documentId) as ScanRow[]).map(metadata);
}
export function readSignedScan(id:string) {
  const row=db().prepare("SELECT * FROM signed_scans WHERE id=?").get(id) as ScanRow|undefined;
  if(!row)throw new Error("ไม่พบไฟล์สแกน");
  readDraft(row.document_id);
  return {...metadata(row),file:Buffer.from(row.file)};
}
function detectMime(bytes:Buffer){
  if(bytes.subarray(0,5).toString("ascii")==="%PDF-")return "application/pdf";
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0)return "image/png";
  if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217)return "image/jpeg";
  throw new Error("รองรับไฟล์ PDF, PNG หรือ JPEG ที่ถูกต้องเท่านั้น");
}
export async function storeSignedScan(documentId:string,file:File):Promise<SignedScan>{
  if(!file.size||file.size>15*1024*1024)throw new Error("ไฟล์สแกนต้องไม่เกิน 15 MB");
  const bytes=Buffer.from(await file.arrayBuffer()),mime=detectMime(bytes);
  if(file.type&&file.type!=="application/octet-stream"&&file.type!==mime)throw new Error("ชนิดไฟล์ไม่ตรงกับข้อมูลภายใน");
  const name=file.name.replaceAll("/", "_").replaceAll("\\", "_").slice(0,240)||"เอกสารฉบับลงนาม";
  return db().transaction(()=>{
    readDraft(documentId);
    const usage=db().prepare("SELECT COUNT(*) count,COALESCE(SUM(bytes),0) total FROM signed_scans WHERE document_id=?").get(documentId) as {count:number;total:number};
    if(usage.count>=10)throw new Error("เก็บไฟล์สแกนได้สูงสุด 10 ไฟล์ต่อเอกสาร");
    if(usage.total+bytes.length>50*1024*1024)throw new Error("ไฟล์สแกนรวมต้องไม่เกิน 50 MB");
    const id=randomUUID(),uploadedAt=new Date().toISOString();
    db().prepare("INSERT INTO signed_scans(id,document_id,name,mime,bytes,file,uploaded_at) VALUES(?,?,?,?,?,?,?)").run(id,documentId,name,mime,bytes.length,bytes,uploadedAt);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(documentId,"signed_scan_upload",null,uploadedAt);
    return {id,documentId,name,mime,bytes:bytes.length,uploadedAt};
  })();
}
export function removeSignedScan(documentId:string,id:string){
  db().transaction(()=>{
    readDraft(documentId);
    const result=db().prepare("DELETE FROM signed_scans WHERE document_id=? AND id=?").run(documentId,id);
    if(!result.changes)throw new Error("ไม่พบไฟล์สแกนในรายการนี้");
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(documentId,"signed_scan_delete",null,new Date().toISOString());
  })();
}
