import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,readDraft,checkNumber} from './db';
import {documentSchema,newDraft} from './document';
import {mirrorLocalOwner} from './local-dossiers';
import {analyzeWord} from './word-import';
import {DOCX_MIME,wordImportFieldsSchema,wordImportAnalysisSchema,WORD_IMPORT_LIMIT} from './word-import-model';

export async function importWordDraft(file:File,reviewed:unknown,requestId:string){
 z.string().uuid().parse(requestId);
 const fields=wordImportFieldsSchema.parse(reviewed);
 if(!fields.subject.trim())throw Error('กรุณาระบุเรื่องก่อนสร้างร่าง');
 if(file.size>WORD_IMPORT_LIMIT)throw Error('เลือกไฟล์ Word ขนาดไม่เกิน 10 MB');
 const bytes=Buffer.from(await file.arrayBuffer()),analysis=await analyzeWord(bytes,file.name);
 const draft=documentSchema.parse({...newDraft(fields.type),...fields,status:'draft',numeralStyle:'thai',bodyMode:'free',contentBlocks:[]});
 const requestHash=createHash('sha256').update(analysis.sha256).update(JSON.stringify(draft)).digest('hex');
 const saved=db().transaction(()=>{
  const previous=db().prepare('SELECT document_id,request_hash FROM document_sources WHERE id=?').get(requestId);
  if(previous){if(previous.request_hash!==requestHash)throw Error('คำขอนำเข้านี้ถูกใช้แล้ว กรุณาเปิดหน้าการนำเข้าใหม่');return readDraft(String(previous.document_id));}
  const id=randomUUID(),now=new Date().toISOString();checkNumber(draft,id);
  db().prepare('INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)').run(id,JSON.stringify(draft),now,now);
  const name=file.name.replace(/[\\/\x00-\x1f]/g,'_').slice(-200);
  db().prepare('INSERT INTO document_sources(id,document_id,name,mime,bytes,file,sha256,analysis,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(requestId,id,name,DOCX_MIME,bytes.length,bytes,analysis.sha256,JSON.stringify(analysis),requestHash,now);
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'word_import',1,now);
  return readDraft(id);
 })();
 return {...saved,localFileWarning:mirrorLocalOwner('document',saved.id)};
}
export function listDocumentSources(documentId:string){
 readDraft(documentId);
 return db().prepare('SELECT id,name,bytes,created_at,analysis FROM document_sources WHERE document_id=? ORDER BY created_at').all(documentId).map(row=>({id:String(row.id),name:String(row.name),bytes:Number(row.bytes),createdAt:String(row.created_at),analysis:wordImportAnalysisSchema.parse(JSON.parse(String(row.analysis)))}));
}
export function readDocumentSource(id:string){
 const row=db().prepare('SELECT * FROM document_sources WHERE id=?').get(id);if(!row)throw Error('ไม่พบต้นฉบับ');readDraft(String(row.document_id));return {name:String(row.name),bytes:Number(row.bytes),file:Buffer.from(row.file as Uint8Array),mime:DOCX_MIME};
}
// Duplicating a draft keeps its provenance, but never carries its review/number status.
export function duplicateDraftWithSources(id:string){
 const original=readDraft(id),draft=documentSchema.parse({...original,subject:original.subject.slice(0,280)+' (สำเนาร่าง)',number:'',status:'draft'});
 const saved=db().transaction(()=>{
  const key=randomUUID(),now=new Date().toISOString();db().prepare('INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)').run(key,JSON.stringify(draft),now,now);
  for(const row of db().prepare('SELECT * FROM document_sources WHERE document_id=?').all(id))db().prepare('INSERT INTO document_sources(id,document_id,name,mime,bytes,file,sha256,analysis,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),key,row.name,row.mime,row.bytes,row.file,row.sha256,row.analysis,row.request_hash,now);
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(key,'create',1,now);return readDraft(key);
 })();return {...saved,localFileWarning:mirrorLocalOwner('document',saved.id)};
}
