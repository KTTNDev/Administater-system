import fs from 'node:fs';
import path from 'node:path';
import {inside,atomicFile,fileHash,safePart,fiscalFolder,mirrorWorkspaceFiles} from './workspace-files.mjs';

const tableExists=(db,name)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const all=(db,name)=>tableExists(db,name)?db.prepare('SELECT * FROM '+name+' ORDER BY id').all():[];
const row=(db,name,id)=>tableExists(db,name)?db.prepare('SELECT * FROM '+name+' WHERE id=?').get(id):null;
const metadataName='ฉบับส่งออก/ข้อมูลการส่งออก.json';
const ownerKind=kind=>kind==='inventory-movement'?'inventory':kind==='inventory-report'?'report':kind;

// Capture before rendering and compare again before saving. A PDF must never be
// filed under a newer data revision simply because rendering took several seconds.
export function reportSourceSnapshot(db,kind,id){
 let source,version=0;
 if(kind==='project'){
  const project=row(db,'office_items',id);if(!project||JSON.parse(project.data).kind!=='project')return null;
  source=[project,all(db,'office_items').filter(r=>JSON.parse(r.data).projectId===id),(tableExists(db,'project_files')?db.prepare('SELECT * FROM project_files WHERE project_id=? ORDER BY id').all(id):[]).map(({file,...r})=>({...r,sha256:fileHash(Buffer.from(file))}))];version=project.version;
 }else if(kind==='inventory-form'){
  const form=row(db,'inventory_form_drafts',id);if(!form)return null;source=form;version=form.version;
 }else if(kind==='inventory-movement'||kind==='inventory-report'){
  if(kind==='inventory-movement'){const movement=row(db,'inventory_movements',id);if(!movement)return null;version=movement.version;}
  source=[all(db,'inventory_items'),all(db,'inventory_movements')];
 }else throw Error('ชนิดรายงานไม่รองรับ');
 const organization=tableExists(db,'settings')?db.prepare("SELECT value FROM settings WHERE key='organization'").get()?.value||'':'';
 return {fingerprint:fileHash(JSON.stringify([kind,source,organization])),version:Number(version)||0};
}
export function prepareReportOutput(db,kind,id,title,context={}){
 // Sorting makes query parameter order irrelevant; the note and filters remain
 // part of the identity so reports with different contents never share a folder.
 const normalized=Object.fromEntries(Object.entries(context).sort(([a],[b])=>a.localeCompare(b)));
 if(kind==='inventory-report')id=fileHash(JSON.stringify(normalized)).slice(0,32);
 const snapshot=reportSourceSnapshot(db,kind,id);if(!snapshot)throw Error('ไม่พบรายการต้นทางของรายงาน');
 return {kind,id,title,context:normalized,...snapshot};
}
function periodFolder(root,source){
 const {start='',end=''}=source.context,first=fiscalFolder(start),last=fiscalFolder(end);
 const year=start&&end?(first===last?first:'ช่วงหลายปีงบประมาณ'):start?first:end?last:'ไม่ระบุช่วงปีงบประมาณ';
 const period=(start||'เริ่มต้น')+' ถึง '+(end||'ปัจจุบัน');
 return inside(root,path.join('พัสดุและครุภัณฑ์','รายงานตามช่วงเวลา',year,safePart(source.title+' '+period,52)+'--'+source.id));
}
export function readReportMetadata(folder){
 const file=inside(folder,metadataName);if(!fs.existsSync(file))return null;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.schemaVersion!==1||!Array.isArray(data.files)||!data.source?.fingerprint||!data.ownerId)throw Error('รายการฉบับส่งออกไม่ถูกต้อง');
 for(const entry of data.files){if(!['pdf','docx','csv'].includes(entry.format)||!String(entry.path).startsWith('ฉบับส่งออก/')||!entry.sha256)throw Error('รายการไฟล์รายงานไม่ถูกต้อง');inside(folder,entry.path);}
 return data;
}
export function reportPeriodOwners(root){
 const file=inside(root,'.sarabun-report-index.json');if(!fs.existsSync(file))return [];
 const index=JSON.parse(fs.readFileSync(file,'utf8'));if(index.schemaVersion!==1||!index.folders||typeof index.folders!=='object')throw Error('ดัชนีรายงานไม่ถูกต้อง');
 return Object.entries(index.folders).map(([id,relative])=>{const folder=inside(root,relative),data=readReportMetadata(folder);if(!data||data.ownerKind!=='report'||data.ownerId!==id||data.source.kind!=='inventory-report'||data.source.id!==id)throw Error('รายงานไม่ตรงกับแฟ้มต้นทาง');return {kind:'report',id,folder,ok:true};});
}
export function reportFolderFromIndex(root,kind,id){
 const indexFile=inside(root,kind==='report'?'.sarabun-report-index.json':'.sarabun-file-index.json');if(!fs.existsSync(indexFile))return null;
 const index=JSON.parse(fs.readFileSync(indexFile,'utf8')),key=kind==='inventory'?'inventory_movements:'+id:kind+':'+id;
 const relative=index.folders?.[kind==='report'?id:key];return relative?inside(root,relative):null;
}
export function reportOutputState(db,root,kind,id){
 const folder=reportFolderFromIndex(root,kind,id);if(!folder)return null;const data=readReportMetadata(folder);if(!data)return null;
 if(data.ownerKind!==kind||data.ownerId!==id)throw Error('ฉบับส่งออกไม่ตรงกับเจ้าของแฟ้ม');
 // Period reports are historical snapshots of the requested range. Other
// outputs are only advertised as current while their source still matches.
 const snapshot=kind==='report'?null:reportSourceSnapshot(db,data.source.kind,data.source.id);
 return {folder,data,current:kind==='report'||snapshot?.fingerprint===data.source.fingerprint,fingerprint:fileHash(JSON.stringify(data))};
}
export function saveReportOutput(db,root,source,extension,bytes){
 if(!['pdf','docx','csv'].includes(extension)||!bytes.length)throw Error('ชนิดหรือเนื้อหารายงานไม่ถูกต้อง');
 const current=reportSourceSnapshot(db,source.kind,source.id);if(!current||current.fingerprint!==source.fingerprint)throw Error('ข้อมูลต้นทางเปลี่ยนระหว่างสร้างรายงาน กรุณาส่งออกใหม่');
 const kind=ownerKind(source.kind);
 const folder=kind==='report'?periodFolder(root,source):mirrorWorkspaceFiles(db,root,{kind,id:source.id}).find(r=>r.id===source.id&&r.ok)?.folder;
 if(!folder)throw Error('จัดแฟ้มต้นทางของรายงานไม่สำเร็จ');
 const previous=readReportMetadata(folder);
 if(previous&&(previous.ownerKind!==kind||previous.ownerId!==source.id))throw Error('พบแฟ้มรายงานของเรื่องอื่น ไม่เขียนทับ');
 const hash=fileHash(bytes),stamp=new Date().toISOString(),revision=source.version?'v'+source.version:source.fingerprint.slice(0,10);
 const filename=safePart(source.title,30)+'-'+revision+'--'+hash.slice(0,16)+'.'+extension;
 const relative='ฉบับส่งออก/'+filename,file=inside(folder,relative);
 if(fs.existsSync(file)){if(fileHash(fs.readFileSync(file))!==hash)throw Error('ฉบับส่งออกในเครื่องถูกแก้ไขจากภายนอก ไม่เขียนทับ');}else atomicFile(file,bytes);
 const record={id:extension,kind:'report-output',format:extension,path:relative,sha256:hash,bytes:bytes.length};
 const files=(previous?.source.fingerprint===source.fingerprint?previous.files:[]).filter(f=>f.format!==extension);files.push(record);
 atomicFile(inside(folder,metadataName),JSON.stringify({schemaVersion:1,ownerKind:kind,ownerId:source.id,source,generatedAt:stamp,files,note:'ไฟล์ในรายการนี้เป็นฉบับส่งออกล่าสุดต่อรูปแบบของข้อมูลรุ่นที่ระบุ ไฟล์รุ่นก่อนเก็บไว้ในเครื่องเพื่อไม่ให้ข้อมูลสูญหาย'},null,2));
 if(kind==='report'){
  const indexFile=inside(root,'.sarabun-report-index.json'),index=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile,'utf8')):{schemaVersion:1,folders:{}};
  if(index.schemaVersion!==1||!index.folders)throw Error('ดัชนีรายงานไม่ถูกต้อง');index.folders[source.id]=path.relative(root,folder);atomicFile(indexFile,JSON.stringify(index,null,2));
 }
 return file;
}
export const reportMetadataPath=metadataName;
