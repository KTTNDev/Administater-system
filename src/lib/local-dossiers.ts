import 'server-only';
import {prepareReportOutput,saveReportOutput,type ReportKind,type ReportSource} from '../../scripts/report-files.mjs';
import path from 'node:path';
import {db,databaseFile,getSetting,setSetting} from './db';
import {mirrorWorkspaceFiles,saveDocumentOutput,type SqlReader} from '../../scripts/workspace-files.mjs';
export function localFilesRoot(){
 // Tests get their own default directory and must never touch the user's files.
 return getSetting('storage:local')||path.join(process.env.NODE_ENV==='test'?path.dirname(databaseFile()):(process.env.SARABUN_SOURCE_DIR||process.cwd()),'output','storage');
}
export function localFileWarnings(){return db().prepare("SELECT key,value FROM settings WHERE key LIKE 'storage:mirror-error:%'").all().map(r=>({key:String(r.key),...JSON.parse(String(r.value)) as {message:string;at:string}}));}
function recordResult(key:string,error?:unknown){
 if(error)setSetting('storage:mirror-error:'+key,JSON.stringify({message:error instanceof Error?error.message:String(error),at:new Date().toISOString()}));
 else db().prepare('DELETE FROM settings WHERE key=?').run('storage:mirror-error:'+key);
}
// DB remains authoritative. A disk error never turns a committed save into a
// misleading failure/retry that could create a duplicate document.
export function mirrorLocalOwner(kind:string,id:string){
 const key=kind+':'+id;
 try{const result=mirrorWorkspaceFiles(db(),localFilesRoot(),{kind,id});const bad=result.find(r=>!r.ok);if(bad)throw Error(bad.error||'ไฟล์อ้างอิงไม่ครบ: '+bad.missing?.map(x=>x.id).join(', '));recordResult(key);return '';}
 catch(error){recordResult(key,error);return 'บันทึกในฐานข้อมูลแล้ว แต่จัดแฟ้มในเครื่องยังไม่ครบ กรุณาตรวจที่ตั้งค่า → ที่เก็บและสำรองข้อมูล';}
}
export function organizeAllLocalFiles(){
 const results=mirrorWorkspaceFiles(db(),localFilesRoot());
 for(const r of results)recordResult(r.kind+':'+r.id,r.ok?undefined:Error(r.error||'ไฟล์อ้างอิงไม่ครบ'));
 return results;
}
export function saveLocalDocumentOutput(d:{id:string;version:number},extension:'pdf'|'docx',bytes:Uint8Array){
 const key='output:'+d.id+':'+extension;
 try{const file=saveDocumentOutput(db() as SqlReader,localFilesRoot(),d.id,d.version,extension,bytes);recordResult(key);return file;}
 catch(error){recordResult(key,error);throw Error('สร้างเอกสารแล้ว แต่เก็บสำเนาในแฟ้มไม่สำเร็จ กรุณาตรวจที่เก็บและลองส่งออกอีกครั้ง');}
}

// Reports use the same configured storage root as letters and attachments.
export function localReportSource(kind:ReportKind,id:string,title:string,context:Record<string,string>={}){return prepareReportOutput(db(),kind,id,title,context);}
export function saveLocalReportOutput(source:ReportSource,extension:'pdf'|'docx'|'csv',bytes:Uint8Array){
 const key='report:'+source.kind+':'+source.id+':'+extension;
 try{const file=saveReportOutput(db(),localFilesRoot(),source,extension,bytes);recordResult(key);return file;}
 catch(error){recordResult(key,error);throw Error(error instanceof Error?error.message:'สร้างรายงานแล้ว แต่เก็บสำเนาไม่สำเร็จ กรุณาตรวจที่เก็บและลองส่งออกใหม่');}
}
