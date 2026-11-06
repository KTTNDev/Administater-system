import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inside,mirrorWorkspaceFiles,fileHash} from './workspace-files.mjs';
import {reportOutputState,reportPeriodOwners,reportMetadataPath} from './report-files.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const mimeFor=name=>({'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json','.txt':'text/plain','.csv':'text/csv'}[path.extname(name).toLowerCase()]||'application/octet-stream');
const tableFor={document:'documents',project:'office_items',inventory:'inventory_items',law:'legal_library','inventory-form':'inventory_form_drafts'};
export function dossierOwnerSnapshot(db,kind,id,root){
 const report=root?reportOutputState(db,root,kind,id):null;
 if(kind==='report')return report?{fingerprint:report.fingerprint,label:report.data.source.title,version:0}:null;

 let table=tableFor[kind],row=table&&db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)?db.prepare('SELECT * FROM '+table+' WHERE id=?').get(id):null;
 if(!row&&kind==='inventory'){table='inventory_movements';row=db.prepare('SELECT * FROM '+table+' WHERE id=?').get(id);}
 if(!row)return null;const data=JSON.parse(row.data);
 if(row.deleted_at||kind==='document'&&data.confidentiality&&data.confidentiality!=='ปกติ')return null;
 // Include the current relationship set, so removing a scan or project file
 // while syncing prevents the old plan from publishing that removed file.
 const related=[];for(const [t,column] of kind==='document'?[['signed_scans','document_id'],['document_sources','document_id']]:kind==='project'?[['project_files','project_id']]:kind==='inventory'?[['inventory_files','owner_id']]:[]){if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t))related.push(...db.prepare('SELECT id FROM '+t+' WHERE '+column+'=? ORDER BY id').all(id).map(r=>r.id));}
 if(kind==='project'){related.push(...db.prepare("SELECT id,data,version FROM office_items WHERE json_extract(data,'$.projectId')=? ORDER BY id").all(id));if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='project_files'").get())related.push(...db.prepare('SELECT id,caption,include_report,stage,task_id FROM project_files WHERE project_id=? ORDER BY id').all(id));}
 return {fingerprint:sha(JSON.stringify([row.data,row.version,row.updated_at,related,report?[report.fingerprint,report.current]:null])),label:data.subject||data.title||data.name||data.number||id,version:Number(row.version)||0};
}
export function buildDossierSyncPlan(db,root){
 const organized=[...mirrorWorkspaceFiles(db,root),...reportPeriodOwners(root)],entries=[],skipped=[];
 for(const owner of organized){
  if(!owner.ok){skipped.push({label:owner.id,reason:owner.error||'ไฟล์อ้างอิงไม่ครบ'});continue;}
  const snapshot=dossierOwnerSnapshot(db,owner.kind,owner.id,root);if(!snapshot){skipped.push({label:owner.id,reason:'อยู่ในถังขยะหรือเป็นหนังสือลับ'});continue;}
  const folder=inside(root,path.relative(root,owner.folder)),relative=path.relative(root,folder),parts=relative.split(path.sep),ownerFolder=parts.pop();
  const manifestFile=inside(folder,'รายการไฟล์.json'),manifest=owner.kind==='report'?{files:[]}:JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const records=[...manifest.files];
  const dataName={document:'เอกสาร/ข้อมูลร่าง.json',project:'ข้อมูลโครงการ.json',inventory:'ข้อมูลรายการ.json',law:'ข้อมูลกฎหมาย.json','inventory-form':'ข้อมูลแบบฟอร์ม.json'}[owner.kind];
  if(dataName)records.push({id:'data',path:dataName});
  const report=reportOutputState(db,root,owner.kind,owner.id);
  if(report?.current){records.push(...report.data.files,{id:'output-metadata',path:reportMetadataPath});}
  else if(report)skipped.push({label:snapshot.label,reason:'ข้อมูลเปลี่ยนหลังส่งออกรายงาน กรุณาส่งออกใหม่ก่อนซิงก์ฉบับล่าสุด (ไฟล์เดิมยังอยู่ในเครื่อง)'});

  if(owner.kind==='document')for(const item of fs.readdirSync(inside(folder,'เอกสาร'),{withFileTypes:true})){
   if(item.isFile()&&new RegExp('^หนังสือ-v'+snapshot.version+'--.*\\.(pdf|docx)$').test(item.name))records.push({id:item.name,path:'เอกสาร/'+item.name});
  }
  for(const record of records){
   const file=inside(folder,record.path),bytes=fs.readFileSync(file),hash=fileHash(bytes);if(record.sha256&&record.sha256!==hash){skipped.push({label:snapshot.label+' / '+record.path,reason:'ไฟล์ในเครื่องถูกแก้ไขจากภายนอก'});continue;}
   const sub=record.path.split(/[\\/]/),name=sub.pop(),key=sha(JSON.stringify([owner.kind,owner.id,record.kind||'',record.id,hash]));
   entries.push({key,ownerKind:owner.kind,ownerId:owner.id,ownerLabel:snapshot.label,ownerFingerprint:snapshot.fingerprint,groups:parts,ownerFolder,subfolders:sub,name,mime:mimeFor(name),relativePath:path.relative(root,file),sha256:hash,md5:createHash('md5').update(bytes).digest('hex'),bytes:bytes.length,status:'pending'});
  }
 }
 return {entries,skipped};
}
