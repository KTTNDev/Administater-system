import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const folderMime='application/vnd.google-apps.folder';
const fields='id,name,mimeType,parents,trashed,size,md5Checksum,appProperties';
const options={timeout:30000,retry:false};
const code=e=>Number(e?.code||e?.response?.status);
async function get(drive,id){try{return (await drive.files.get({fileId:id,fields,supportsAllDrives:true},options)).data;}catch(e){if(code(e)===404)return null;throw e;}}
async function lookup(drive,ns,key){const r=await drive.files.list({q:`trashed=false and appProperties has { key='storageNamespace' and value='${escape(ns)}' } and appProperties has { key='storageKey' and value='${escape(key)}' }`,fields:'files('+fields+')',pageSize:10,supportsAllDrives:true,includeItemsFromAllDrives:true},options);return r.data.files?.[0]||null;}
async function reserve(drive,store,key){const id=(await drive.files.generateIds({count:1},options)).data.ids?.[0];if(!id)throw Error('Drive ไม่ส่งรหัสไฟล์กลับมา');store.set(key,id);store.set(key+':exists','0');return id;}
async function ensureFolder(drive,store,ns,parent,name,key,adopt,cache){
 const memory=ns+':'+key;if(cache?.has(memory))return cache.get(memory);
 const setting='drive:dossier:'+memory;let id=store.get(setting),node=id?await get(drive,id):null;
 if(node?.trashed){node=null;id=undefined;}if(!node&&id&&store.get(setting+':exists')==='1')id=undefined;
 if(node&&adopt&&!(node.parents||[]).includes(parent)){node=null;id=undefined;}
 if(node&&(node.mimeType!==folderMime||!adopt&&(node.appProperties?.storageNamespace!==ns||node.appProperties?.storageKey!==key)))throw Error('โฟลเดอร์ปลายทางไม่ตรงกับแฟ้มงาน ไม่เปลี่ยนข้อมูลของไฟล์อื่น');
 if(!node){node=await lookup(drive,ns,key);if(node){id=node.id;store.set(setting,id);}}
 if(!node&&adopt){const r=await drive.files.list({q:`trashed=false and mimeType='${folderMime}' and name='${escape(name)}' and '${escape(parent)}' in parents`,fields:'files('+fields+')',pageSize:10,supportsAllDrives:true,includeItemsFromAllDrives:true},options);node=r.data.files?.[0];if(node){id=node.id;store.set(setting,id);}}
 if(!node){
  // Keep a reserved ID after a network failure. A retry can GET the accepted
  // object even when the original create response never reached this app.
  id=id||await reserve(drive,store,setting);
  try{node=(await drive.files.create({requestBody:{id,name,mimeType:folderMime,parents:[parent],appProperties:{application:'sarabun',storageNamespace:ns,storageKey:key}},fields,supportsAllDrives:true},options)).data;}
  catch(e){if(code(e)!==409)throw e;node=await get(drive,id);if(!node||node.mimeType!==folderMime||node.appProperties?.storageKey!==key||node.appProperties?.storageNamespace!==ns)throw e;}
 }
 const parents=node.parents||[];
 if(node.name!==name||!parents.includes(parent))await drive.files.update({fileId:id,requestBody:{name},addParents:parents.includes(parent)?undefined:parent,removeParents:parents.filter(p=>p!==parent).join(',')||undefined,fields:'id',supportsAllDrives:true},options);
 store.set(setting+':exists','1');cache?.set(memory,id);return id;
}
export async function uploadDossierEntry(drive,store,ns,root,entry,bytes,cache=new Map()){
 if(hash(bytes)!==entry.sha256)throw Error('ไฟล์ในเครื่องเปลี่ยนแล้ว กรุณาเตรียมรายการซิงก์ใหม่');
 let parent=root;
 for(const name of entry.groups)parent=await ensureFolder(drive,store,ns,parent,name,'group:'+hash(parent+':'+name),true,cache);
 const ownerKey=entry.ownerKind+':'+entry.ownerId;
 parent=await ensureFolder(drive,store,ns,parent,entry.ownerFolder,'owner:'+hash(ownerKey),false,cache);
 let sub='';for(const name of entry.subfolders){sub+='/'+name;parent=await ensureFolder(drive,store,ns,parent,name,'sub:'+hash(ownerKey+sub),false,cache);}
 const key='file:'+entry.key,setting='drive:dossier:'+ns+':'+key;let id=store.get(setting),node=id?await get(drive,id):null;
 if(node?.trashed){node=null;id=undefined;}if(!node&&id&&store.get(setting+':exists')==='1')id=undefined;
 if(node&&(node.appProperties?.storageNamespace!==ns||node.appProperties?.storageKey!==key))throw Error('รหัสไฟล์ Drive ไม่ตรงกับรายการ ไม่เขียนทับไฟล์อื่น');
 if(!node){node=await lookup(drive,ns,key);if(node){id=node.id;store.set(setting,id);}}
 if(!node){id=id||await reserve(drive,store,setting);try{await drive.files.create({requestBody:{id,name:entry.name,parents:[parent],mimeType:entry.mime,appProperties:{application:'sarabun',storageNamespace:ns,storageKey:key,ownerKind:entry.ownerKind,ownerId:entry.ownerId,sha256:entry.sha256}},media:{mimeType:entry.mime,body:Readable.from(bytes)},fields:'id',supportsAllDrives:true},options);}catch(e){if(code(e)!==409)throw e;}node=await get(drive,id);}
 if(!node||node.trashed||node.appProperties?.storageKey!==key||node.appProperties?.storageNamespace!==ns)throw Error('ตรวจไฟล์บน Drive ไม่สำเร็จ');
 if(node.md5Checksum!==entry.md5||Number(node.size)!==bytes.length)throw Error('ไฟล์บน Drive ไม่ตรงกับต้นฉบับหรือถูกแก้ไขจากภายนอก ระบบไม่เขียนทับ กรุณาตรวจไฟล์นั้น');
 const parents=node.parents||[];if(node.name!==entry.name||!parents.includes(parent))await drive.files.update({fileId:id,requestBody:{name:entry.name},addParents:parents.includes(parent)?undefined:parent,removeParents:parents.filter(p=>p!==parent).join(',')||undefined,fields:'id',supportsAllDrives:true},options);
 store.set(setting+':exists','1');return {fileId:id,verifiedAt:new Date().toISOString()};
}
