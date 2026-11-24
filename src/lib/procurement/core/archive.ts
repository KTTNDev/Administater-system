import 'server-only';
import {createHash} from 'node:crypto';
import {db} from '../../db';
import {procurementSchema,procurementFileSchema} from '../../procurement';
const exists=(name:string)=>!!db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
/** Read-only access: never initializes legacy tables, templates or a rendering process. */
export function readArchivedProcurementCases(){
  return exists('procurement_cases')?db().prepare('SELECT * FROM procurement_cases ORDER BY updated_at DESC').all().map(row=>({...procurementSchema.parse(JSON.parse(String(row.data))),id:String(row.id),version:Number(row.version),updatedAt:String(row.updated_at)})):[];
}
export function readProcurementArchive(){
  const cases=readArchivedProcurementCases();
  const files=exists('procurement_files')?db().prepare('SELECT id,case_id,name,mime,data,created_at,length(file) bytes FROM procurement_files ORDER BY created_at DESC').all().map(row=>({id:String(row.id),caseId:String(row.case_id),name:String(row.name),mime:String(row.mime),bytes:Number(row.bytes),createdAt:String(row.created_at),meta:procurementFileSchema.parse(JSON.parse(String(row.data)))})):[];
  return {cases,files};
}
export function readArchivedProcurementFile(id:string){
  const row=exists('procurement_files')&&exists('procurement_cases')?db().prepare('SELECT f.name,f.mime,f.file,f.sha256 FROM procurement_files f INNER JOIN procurement_cases c ON c.id=f.case_id WHERE f.id=?').get(id):undefined;
  if(!row)throw Error('ไม่พบไฟล์ที่จัดเก็บไว้');
  const bytes=Buffer.from(row.file as Uint8Array);
  if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new ArchiveFileIntegrityError();
  return {name:String(row.name),mime:String(row.mime),bytes};
}
export class ArchiveFileIntegrityError extends Error{constructor(){super('ไฟล์ไม่ตรงกับหลักฐานที่เก็บไว้ กรุณาตรวจชุดสำรอง');}}
