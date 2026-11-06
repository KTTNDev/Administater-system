import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export const documentFolders={external:'หนังสือภายนอก',internal:'หนังสือภายใน',stamped:'หนังสือประทับตรา',order:'คำสั่ง',regulation:'ระเบียบ',rule:'ข้อบังคับ',announcement:'ประกาศ',statement:'แถลงการณ์',news:'ข่าว',certificate:'หนังสือรับรอง',minutes:'รายงานการประชุม',memorandum:'บันทึก',other:'หนังสืออื่น'};
export const fileHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function safePart(value,max=50){let name=String(value||'').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').trim().slice(0,max).replace(/[. ]+$/g,'');if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))name='_'+name;return name||'ไม่ระบุ';}
export function inside(root,relative=''){
 const base=path.resolve(root),target=path.resolve(base,relative),rel=path.relative(base,target);
 if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('พาธอยู่นอกพื้นที่จัดเก็บ');
 let current=base;
 for(const part of ['',...rel.split(path.sep).filter(Boolean)]){if(part)current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('โฟลเดอร์จัดเก็บต้องไม่เป็นลิงก์ไปยังพื้นที่อื่น');}
 return target;
}
export function atomicFile(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
const has=(db,table)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
const rows=(db,table)=>has(db,table)?db.prepare('SELECT * FROM '+table).all():[];
export function fiscalFolder(date){const match=String(date||'').match(/^(\d{4})-(\d{2})-/);return match?`ปีงบประมาณ ${Number(match[1])+543+(Number(match[2])>=10?1:0)}`:'ไม่ระบุปีงบประมาณ';}
function indexedFolder(root,key,relative){
 inside(root);fs.mkdirSync(root,{recursive:true});const indexFile=inside(root,'.sarabun-file-index.json');
 const index=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile,'utf8')):{schemaVersion:1,folders:{}};
 if(index.schemaVersion!==1||typeof index.folders!=='object')throw Error('ดัชนีแฟ้มงานไม่ถูกต้อง');
 const folder=inside(root,relative),previous=index.folders[key];
 if(previous&&previous!==relative){const old=inside(root,previous);if(fs.existsSync(old)){if(fs.existsSync(folder))throw Error('พบแฟ้มชื่อซ้ำที่ปลายทาง กรุณาตรวจสอบก่อนจัดแฟ้ม');fs.mkdirSync(path.dirname(folder),{recursive:true});fs.renameSync(old,folder);}}
 fs.mkdirSync(folder,{recursive:true});index.folders[key]=relative;atomicFile(indexFile,JSON.stringify(index,null,2));return folder;
}
function saveAsset(folder,subfolder,name,id,bytes){
 const ext=path.extname(name).slice(0,10),base=safePart(path.basename(name,ext),36),hash=fileHash(bytes);
 const relative=path.join(subfolder,`${base}--${safePart(id,12)}-${hash.slice(0,8)}${ext}`),file=inside(folder,relative);
 if(fs.existsSync(file)){if(fileHash(fs.readFileSync(file))!==hash)throw Error('ไฟล์ในแฟ้มถูกแก้ไขจากภายนอก กรุณาตรวจสอบก่อนเขียนทับ');}
 else atomicFile(file,bytes);
 return {id,name,path:relative.split(path.sep).join('/'),sha256:hash,bytes:bytes.length};
}
export function documentDossier(db,root,id){
 const row=db.prepare('SELECT * FROM documents WHERE id=?').get(id);if(!row)throw Error('ไม่พบเอกสาร');const d=JSON.parse(row.data);
 const relative=path.join(row.deleted_at?'ถังขยะ':'หนังสือราชการ',documentFolders[d.type]||'หนังสืออื่น',fiscalFolder(d.date),safePart(d.subject,40)+'--'+safePart(id,12));
 const folder=indexedFolder(root,'document:'+id,relative),files=[],missing=[];
 for(const name of ['เอกสาร','ไฟล์แนบ','รูปภาพ','ฉบับลงนาม'])fs.mkdirSync(inside(folder,name),{recursive:true});
 atomicFile(inside(folder,'เอกสาร/ข้อมูลร่าง.json'),JSON.stringify({id,version:row.version,...d},null,2));
 for(const ref of d.attachmentFiles||[]){const a=has(db,'document_attachments')?db.prepare('SELECT * FROM document_attachments WHERE id=?').get(ref.id):null;if(!a){missing.push({kind:'attachment',id:ref.id});continue;}
  files.push({...saveAsset(folder,'ไฟล์แนบ/สำหรับพิมพ์',a.name,a.id,Buffer.from(a.file)),kind:'attachment'});
  if(a.original)files.push({...saveAsset(folder,'ไฟล์แนบ/ต้นฉบับ',a.original_name||a.name,a.id,Buffer.from(a.original)),kind:'original'});
 }
 const imageRefs=[...(d.appendixImages||[]),...(d.floatingItems||[]).filter(x=>x.kind==='image').map(x=>x.image)];
 for(const ref of [...new Map(imageRefs.map(x=>[x.id,x])).values()]){const image=has(db,'document_appendix_images')?db.prepare('SELECT * FROM document_appendix_images WHERE id=?').get(ref.id):null;if(!image){missing.push({kind:'image',id:ref.id});continue;}files.push({...saveAsset(folder,'รูปภาพ',image.name,image.id,Buffer.from(image.file)),kind:'image'});}
 if(has(db,'document_sources'))for(const source of db.prepare('SELECT * FROM document_sources WHERE document_id=?').all(id))files.push({...saveAsset(folder,'เอกสาร/ต้นฉบับนำเข้า',source.name,source.id,Buffer.from(source.file)),kind:'import-source'});
 if(has(db,'signed_scans'))for(const scan of db.prepare('SELECT * FROM signed_scans WHERE document_id=?').all(id))files.push({...saveAsset(folder,'ฉบับลงนาม',scan.name,scan.id,Buffer.from(scan.file)),kind:'signed'});
 atomicFile(inside(folder,'รายการไฟล์.json'),JSON.stringify({schemaVersion:1,documentId:id,subject:d.subject,documentVersion:row.version,updatedAt:new Date().toISOString(),files,missing,note:'รายการนี้ระบุไฟล์ที่ผูกอยู่กับเรื่องปัจจุบัน ไฟล์รุ่นก่อนหรือที่นำออกจากร่างอาจยังเก็บไว้ในแฟ้มเพื่อป้องกันการสูญหาย'},null,2));
 return {folder,files:files.length,missing};
}
export function saveDocumentOutput(db,root,id,version,extension,bytes){
 if(!['pdf','docx','html'].includes(extension))throw Error('ชนิดเอกสารไม่รองรับ');
 const {folder}=documentDossier(db,root,id);return inside(folder,saveAsset(folder,'เอกสาร','หนังสือ-v'+version+'.'+extension,'v'+version,bytes).path);
}

// Scope lets a single save refresh its own dossier without scanning every blob.
export function mirrorWorkspaceFiles(db,root,scope){
 if(!scope)translateLegacyDocumentFolders(db,root);
 const results=[];
 const selected=(kind,id)=>!scope||scope.kind===kind&&(!scope.id||scope.id===id);
 function capture(kind,id,work){try{const result=work();results.push({kind,id,...result,ok:!result.missing?.length});}catch(error){results.push({kind,id,ok:false,error:error.message});}}
 if(!scope||scope.kind==='document')for(const doc of rows(db,'documents').filter(r=>selected('document',r.id)))capture('document',doc.id,()=>documentDossier(db,root,doc.id));
 if(!scope||scope.kind==='project')for(const p of rows(db,'office_items').filter(r=>selected('project',r.id)&&JSON.parse(r.data).kind==='project'))capture('project',p.id,()=>{
  const project=JSON.parse(p.data),folder=indexedFolder(root,'project:'+p.id,path.join('โครงการ','ปีงบประมาณ '+safePart(project.fiscalYear),safePart(project.title,40)+'--'+safePart(p.id,12)));
  const tasks=rows(db,'office_items').map(r=>({...JSON.parse(r.data),id:r.id,version:r.version})).filter(t=>t.projectId===p.id);
  atomicFile(inside(folder,'ข้อมูลโครงการ.json'),JSON.stringify({id:p.id,version:p.version,...project,tasks},null,2));
  const stages={planning:'01 ที่มาและแผนงาน',approval:'02 เสนออนุมัติ',preparation:'03 เตรียมงาน',delivery:'04 ดำเนินงาน',finance:'05 การเงินและหลักฐาน',evaluation:'06 ประเมินและสรุปผล'};
  const files=[];for(const f of has(db,'project_files')?db.prepare('SELECT * FROM project_files WHERE project_id=?').all(p.id):[]){
   const task=tasks.find(t=>t.id===f.task_id),subfolder=path.join(stages[f.stage]||safePart(f.stage),f.task_id?safePart(task?.title,30)+'--'+safePart(f.task_id,12):'ภาพรวม',String(f.mime).startsWith('image/')?'รูปภาพ':'ไฟล์แนบ');
   const name=f.mime==='image/png'?f.name.replace(/\.[^.]+$/,'')+'.png':f.name;
   files.push({...saveAsset(folder,subfolder,name,f.id,Buffer.from(f.file)),caption:f.caption,taskId:f.task_id,stage:f.stage,includeInReport:!!f.include_report});
  }
  atomicFile(inside(folder,'รายการไฟล์.json'),JSON.stringify({projectId:p.id,files},null,2));return {folder,files:files.length};
 });
 if(!scope||scope.kind==='inventory')for(const [table,kind,ownerType] of [['inventory_items','รายการพัสดุ','item'],['inventory_movements','รายการเบิกจ่าย','movement']])for(const row of rows(db,table).filter(r=>selected('inventory',r.id)))capture('inventory',row.id,()=>{
  const item=JSON.parse(row.data),folder=indexedFolder(root,table+':'+row.id,path.join('พัสดุและครุภัณฑ์',kind,...(ownerType==='movement'?[fiscalFolder(item.date)]:[]),safePart(item.code||item.number||item.name,40)+'--'+safePart(row.id,12)));
  atomicFile(inside(folder,'ข้อมูลรายการ.json'),JSON.stringify({id:row.id,...item,version:row.version,...(ownerType==='item'?{balance:row.balance}:{})},null,2));
  const files=[];for(const f of has(db,'inventory_files')?db.prepare('SELECT * FROM inventory_files WHERE owner_id=? AND owner_type=?').all(row.id,ownerType):[])files.push(saveAsset(folder,String(f.mime).startsWith('image/')?'รูปภาพ':'ไฟล์แนบ',f.mime==='image/png'?f.name.replace(/\.[^.]+$/,'')+'.png':f.name,f.id,Buffer.from(f.file)));
  atomicFile(inside(folder,'รายการไฟล์.json'),JSON.stringify({ownerId:row.id,ownerType,files},null,2));return {folder,files:files.length};
 });
 if(!scope||scope.kind==='inventory-form')for(const row of rows(db,'inventory_form_drafts').filter(r=>selected('inventory-form',r.id)))capture('inventory-form',row.id,()=>{
  const form=JSON.parse(row.data),folder=indexedFolder(root,'inventory-form:'+row.id,path.join('พัสดุและครุภัณฑ์','แบบฟอร์มพัสดุ',fiscalFolder(form.asOf),safePart(form.title,40)+'--'+safePart(row.id,12)));
  atomicFile(inside(folder,'ข้อมูลแบบฟอร์ม.json'),JSON.stringify({id:row.id,...form,version:row.version},null,2));
  atomicFile(inside(folder,'รายการไฟล์.json'),JSON.stringify({formId:row.id,files:[]},null,2));return {folder,files:0};
 });
 if(!scope||scope.kind==='law')for(const row of rows(db,'legal_library').filter(r=>selected('law',r.id)))capture('law',row.id,()=>{
  const law=JSON.parse(row.data),folder=indexedFolder(root,'law:'+row.id,path.join('คลังกฎหมายและระเบียบ',safePart(law.category),safePart(law.year||'ไม่ระบุปี'),safePart(law.title,40)+'--'+safePart(row.id,12)));
  atomicFile(inside(folder,'ข้อมูลกฎหมาย.json'),JSON.stringify({id:row.id,...law},null,2));const files=row.file?[saveAsset(folder,'เอกสาร',row.file_name||'กฎหมาย.pdf',row.id,Buffer.from(row.file))]:[];
  atomicFile(inside(folder,'รายการไฟล์.json'),JSON.stringify({lawId:row.id,files},null,2));return {folder,files:files.length};
 });
 return results;
}

// Copy an existing human-readable archive into an empty installation without
// following links or copying the active database a second time.
export function copyWorkspaceFiles(source,target,activeDatabase=''){
 if(!fs.existsSync(source))return 0;
 const relative=path.relative(path.resolve(source),path.resolve(target));
 if(!relative||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('ปลายทางสำเนาต้องอยู่นอกแฟ้มต้นทาง');
 const excluded=new Set(activeDatabase?[activeDatabase,activeDatabase+'-wal',activeDatabase+'-shm'].map(p=>path.resolve(p)):[]);let count=0;
 function visit(rel=''){for(const item of fs.readdirSync(inside(source,rel),{withFileTypes:true})){
  if(!rel&&item.name==='ฐานข้อมูล')continue;
  const name=path.join(rel,item.name),from=inside(source,name),to=inside(target,name);
  if(item.isSymbolicLink())throw Error('ไม่คัดลอกลิงก์ในแฟ้มงาน');
  if(item.isDirectory())visit(name);else if(item.isFile()&&!excluded.has(path.resolve(from))){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);if(fileHash(fs.readFileSync(from))!==fileHash(fs.readFileSync(to)))throw Error('ตรวจสำเนาไม่ผ่าน: '+name);count++;}
 }}visit();return count;
}

// Only rename folders created by old program versions. User-entered subject
// names remain unchanged. Verify every destination before removing duplicates.
export function translateLegacyDocumentFolders(db,root){
 const plans=[],folders=[];
 for(const [code,thai] of Object.entries(documentFolders)){
  const old=inside(root,path.join('หนังสือราชการ',code));if(!fs.existsSync(old))continue;
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const from=inside(root,path.relative(root,path.join(dir,entry.name)));if(entry.isSymbolicLink())throw Error('พบลิงก์ในแฟ้มเก่า ไม่ย้ายอัตโนมัติ');
   if(entry.isDirectory())visit(from);else if(entry.isFile()){
    const match=entry.name.match(/^([\da-f-]{36})-v(\d+)\.(pdf|docx)$/i),row=match&&has(db,'documents')?db.prepare('SELECT id FROM documents WHERE id=?').get(match[1]):null;
    const parent=row?path.join(documentDossier(db,root,row.id).folder,'เอกสาร','ฉบับส่งออกเดิม'):inside(root,path.join('หนังสือราชการ',thai,'ฉบับส่งออกเดิมที่ยังไม่ผูกกับเรื่อง',...path.relative(old,dir).split(path.sep).filter(Boolean).map(p=>/^\d{4}$/.test(p)?'ปีปฏิทิน '+p:safePart(p))));
    const hash=fileHash(fs.readFileSync(from));let to=inside(root,path.relative(root,path.join(parent,entry.name)));
    if(fs.existsSync(to)&&fileHash(fs.readFileSync(to))!==hash)to=inside(root,path.relative(root,path.join(parent,path.parse(entry.name).name+'--'+hash.slice(0,12)+path.extname(entry.name))));
    if(fs.existsSync(to)&&fileHash(fs.readFileSync(to))!==hash)throw Error('พบชื่อไฟล์ชนกันในแฟ้มปลายทาง');
    plans.push({from,to,hash});
   }
  }folders.push(dir);}
  visit(old);
 }
 for(const p of plans){inside(root,path.relative(root,p.from));inside(root,path.relative(root,p.to));if(fileHash(fs.readFileSync(p.from))!==p.hash)throw Error('ไฟล์เดิมเปลี่ยนระหว่างจัดแฟ้ม กรุณาลองใหม่');fs.mkdirSync(path.dirname(p.to),{recursive:true});
  if(fs.existsSync(p.to)){if(fileHash(fs.readFileSync(p.to))!==p.hash)throw Error('ไฟล์ปลายทางเปลี่ยนระหว่างจัดแฟ้ม');fs.unlinkSync(p.from);}else fs.renameSync(p.from,p.to);
 }
 for(const folder of folders){inside(root,path.relative(root,folder));if(fs.existsSync(folder)&&fs.readdirSync(folder).length===0)fs.rmdirSync(folder);}
 return {folders:folders.length,files:plans.length};
}
