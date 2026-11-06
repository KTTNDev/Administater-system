import {prepareReportOutput,saveReportOutput} from '../scripts/report-files.mjs';
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {uploadDossierEntry} from '../scripts/dossier-drive.mjs';
import {translateLegacyDocumentFolders,documentDossier} from '../scripts/workspace-files.mjs';
const fake=vi.hoisted(()=>({client:null as any,public:false}));
vi.mock('../src/lib/drive',()=>({driveClient:async()=>fake.client,queueDriveJob:async(fn:()=>Promise<unknown>)=>fn(),verifyDriveFolder:async()=>{if(fake.public)throw Error('การสำรองข้อมูลงานต้องใช้โฟลเดอร์ส่วนตัว');return {publicAccess:false};}}));
import {db,setSetting,getSetting,writeDraft} from '../src/lib/db';
import {newDraft} from '../src/lib/document';
import {prepareDossierSync,advanceDossierSync,retryDossierSync,dossierSyncStatus} from '../src/lib/dossier-sync';
const digest=(algorithm:string,b:Buffer)=>createHash(algorithm).update(b).digest('hex');
function remote(){
 const files=new Map<string,any>();let next=0,lost=false,offline=false;const create=vi.fn();
 const client={files:{
 get:async({fileId}:any)=>{if(offline)throw Error('offline');const f=files.get(fileId);if(!f)throw Object.assign(Error('missing'),{code:404});return {data:{...f}};},
 list:async({q}:any)=>({data:{files:[...files.values()].filter(f=>{if(f.trashed)return false;for(const [,key,value] of q.matchAll(/key='([^']+)' and value='([^']+)'/g))if(f.appProperties?.[key]!==value)return false;const name=q.match(/name='([^']+)'/);if(name&&f.name!==name[1])return false;const parent=q.match(/'([^']+)' in parents/);return !parent||f.parents?.includes(parent[1]);})}}),
 generateIds:async()=>({data:{ids:['remote-'+(++next)]}}),
 create:async({requestBody,media}:any)=>{if(offline)throw Error('offline');if(files.has(requestBody.id))throw Object.assign(Error('exists'),{code:409});const chunks=[];if(media)for await(const part of media.body)chunks.push(Buffer.from(part));const bytes=Buffer.concat(chunks),node={...requestBody,...(media?{size:String(bytes.length),md5Checksum:digest('md5',bytes),bytes}:{})};files.set(node.id,node);create(node);if(lost&&media){lost=false;throw Error('lost response');}return {data:node};},
 update:async({fileId,requestBody,addParents,removeParents}:any)=>{const f=files.get(fileId);Object.assign(f,requestBody);if(removeParents)f.parents=f.parents.filter((p:string)=>!removeParents.split(',').includes(p));if(addParents)f.parents=[...(f.parents||[]),addParents];return {data:{...f}};}
 }};
 return {client,files,create,lose(){lost=true;},offline(value:boolean){offline=value;}};
}
let folder:string,r:ReturnType<typeof remote>;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-dossier-drive-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'main.sqlite'));setSetting('storage:local',path.join(folder,'แฟ้มงาน'));setSetting('storage:driveRoot','root-drive-test-123');setSetting('google:account','fixture-account');setSetting('google:token','fake-no-network');r=remote();fake.client=r.client;fake.public=false;});
afterEach(()=>{db().close();(globalThis as any).sarabunDb=undefined;vi.unstubAllEnvs();});
function addDoc(subject='ตัวอย่าง',secret=false){return writeDraft({...newDraft('internal'),subject,date:'2026-10-03',confidentiality:secret?'ลับ':'ปกติ'});}
const store={get:getSetting,set:setSetting};
it('reuses reserved IDs after a lost response and verifies Google checksum before success',async()=>{
 addDoc();const j=prepareDossierSync(),e=j.entries[0],bytes=fs.readFileSync(path.join(j.localRoot,e.relativePath));r.lose();await expect(uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes)).rejects.toThrow('lost response');const count=r.create.mock.calls.length;const done=await uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes);expect(r.create).toHaveBeenCalledTimes(count);expect(r.files.get(done.fileId).md5Checksum).toBe(e.md5);
});
it('can rediscover files after the local cache is lost and replaces a deleted remote file',async()=>{
 addDoc();const j=prepareDossierSync(),e=j.entries[0],bytes=fs.readFileSync(path.join(j.localRoot,e.relativePath));const first=await uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes);db().prepare("DELETE FROM settings WHERE key LIKE 'drive:dossier:%'").run();const again=await uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes);expect(again.fileId).toBe(first.fileId);r.files.delete(first.fileId);const last=await uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes);expect(last.fileId).not.toBe(first.fileId);
});
it('does not overwrite remotely edited contents and does not accept changed local bytes',async()=>{
 addDoc();const j=prepareDossierSync(),e=j.entries[0],bytes=fs.readFileSync(path.join(j.localRoot,e.relativePath)),done=await uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes);r.files.get(done.fileId).md5Checksum='edited';await expect(uploadDossierEntry(r.client,store,j.namespace,j.root,e,bytes)).rejects.toThrow(/ไม่เขียนทับ/);await expect(uploadDossierEntry(r.client,store,j.namespace,j.root,e,Buffer.from('changed'))).rejects.toThrow(/เปลี่ยน/);
});
it('moves the same owned folder after a subject rename without changing other folders',async()=>{
 const d=addDoc(),j=prepareDossierSync(),e=j.entries[0];await uploadDossierEntry(r.client,store,j.namespace,j.root,e,fs.readFileSync(path.join(j.localRoot,e.relativePath)));const owner=[...r.files.values()].find(f=>f.appProperties?.storageKey?.startsWith('owner:'));writeDraft({...d,subject:'ชื่อใหม่'},d.id,d.version);const next=prepareDossierSync(),n=next.entries[0];await uploadDossierEntry(r.client,store,next.namespace,next.root,n,fs.readFileSync(path.join(next.localRoot,n.relativePath)));expect([...r.files.values()].filter(f=>f.appProperties?.storageKey?.startsWith('owner:'))).toHaveLength(1);expect(r.files.get(owner.id).name).toContain('ชื่อใหม่');
});
it('pauses on a connection failure, retries the unsent queue and persists per-file success',async()=>{
 addDoc();let job=prepareDossierSync();r.lose();job=await advanceDossierSync(job.id);expect(job.entries[0].status).toBe('failed');expect(job.pauseReason).toBeTruthy();retryDossierSync(job.id);job=await advanceDossierSync(job.id);expect(job.entries[0].status).toBe('synced');expect(dossierSyncStatus()!.entries[0].fileId).toBeTruthy();expect(r.create.mock.calls.filter(([f])=>f.mimeType!=='application/vnd.google-apps.folder')).toHaveLength(1);
});
it('never uploads confidential or trashed documents, and rejects a changed owner plan',async()=>{
 addDoc('ลับ',true);const d=addDoc('แก้ไข');let j=prepareDossierSync();expect(j.entries.every(e=>e.ownerId===d.id)).toBe(true);expect(j.skipped).toHaveLength(1);writeDraft({...d,subject:'แก้ระหว่างส่ง'},d.id,d.version);j=await advanceDossierSync(j.id);expect(j.entries[0].status).toBe('failed');expect(r.create).not.toHaveBeenCalled();
});
it('rejects public Drive roots and changing the target after preparing a plan',async()=>{
 addDoc();const j=prepareDossierSync();fake.public=true;await expect(advanceDossierSync(j.id)).rejects.toThrow(/ส่วนตัว/);expect(r.create).not.toHaveBeenCalled();fake.public=false;setSetting('storage:driveRoot','another-drive-root-456');await expect(advanceDossierSync(j.id)).rejects.toThrow(/เปลี่ยน/);
});
it('includes original attachments, images and signed scans under one dossier',()=>{
 const d=addDoc(),a=randomUUID(),i=randomUUID(),scan=randomUUID();db().exec('CREATE TABLE document_attachments(id TEXT PRIMARY KEY,name TEXT,pages INTEGER,file BLOB,original BLOB,original_name TEXT);CREATE TABLE document_appendix_images(id TEXT PRIMARY KEY,name TEXT,mime TEXT,file BLOB)');db().prepare('INSERT INTO document_attachments VALUES(?,?,?,?,?,?)').run(a,'แนบ.pdf',1,Buffer.from('print'),Buffer.from('original'),'ต้นฉบับ.png');db().prepare('INSERT INTO document_appendix_images VALUES(?,?,?,?)').run(i,'ภาพ.png','image/png',Buffer.from('image'));db().prepare('INSERT INTO signed_scans VALUES(?,?,?,?,?,?,?)').run(scan,d.id,'ลงนาม.pdf','application/pdf',6,Buffer.from('signed'),'today');writeDraft({...d,attachmentFiles:[{id:a,name:'แนบ.pdf',description:'แนบ',pages:1,bytes:5,originalAvailable:true,quantity:1,unit:'ฉบับ',showNameInDocument:true}],appendixImages:[{id:i,name:'ภาพ.png',mime:'image/png',bytes:5,width:1,height:1,caption:'',widthMm:40}]},d.id,d.version);
 const j=prepareDossierSync();expect(j.entries).toHaveLength(5);expect(new Set(j.entries.map(e=>e.ownerId)).size).toBe(1);expect(j.entries.map(e=>e.subfolders.join('/'))).toContain('ฉบับลงนาม');expect(j.entries.every(e=>e.groups.includes('ปีงบประมาณ 2570'))).toBe(true);
});
it('converts legacy type folders without losing conflicts or changing user subject names',()=>{
 const d=addDoc('CCTV อุปกรณ์'),local=path.join(folder,'แฟ้มงาน'),old=path.join(local,'หนังสือราชการ','internal','2569');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,d.id+'-v1.pdf'),'original');fs.writeFileSync(path.join(old,'not-linked.pdf'),'unknown');const before=documentDossier(db(),local,d.id).folder;const dest=path.join(before,'เอกสาร','ฉบับส่งออกเดิม');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,d.id+'-v1.pdf'),'other-content');const result=translateLegacyDocumentFolders(db(),local);expect(result.files).toBe(2);expect(fs.existsSync(path.join(local,'หนังสือราชการ','internal'))).toBe(false);expect(fs.readdirSync(dest)).toHaveLength(2);expect(fs.readFileSync(path.join(dest,d.id+'-v1.pdf'),'utf8')).toBe('other-content');expect(before).toContain('CCTV');expect(translateLegacyDocumentFolders(db(),local).files).toBe(0);
});

it('syncs report exports with verified bytes and resumes without making duplicate remote copies',async()=>{
 const id=randomUUID();db().exec('CREATE TABLE IF NOT EXISTS inventory_form_drafts(id TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT)');db().prepare('INSERT INTO inventory_form_drafts VALUES(?,?,1,?)').run(id,JSON.stringify({title:'บัญชีวัสดุทดสอบ',asOf:'2026-11-01'}),'2026-11-01');
 const root=getSetting('storage:local')!,source=prepareReportOutput(db(),'inventory-form',id,'บัญชีวัสดุ');saveReportOutput(db(),root,source,'pdf',Buffer.from('report-pdf'));saveReportOutput(db(),root,source,'docx',Buffer.from('report-docx'));
 const range=prepareReportOutput(db(),'inventory-report','','ทะเบียน',{report:'register',start:'2026-10-01',end:'2026-11-01'});saveReportOutput(db(),root,range,'csv',Buffer.from('report-csv'));
 let job=prepareDossierSync();r.lose();job=await advanceDossierSync(job.id);expect(job.entries.some(e=>e.status==='failed')).toBe(true);job=retryDossierSync(job.id);while(job.cursor<job.queue.length)job=await advanceDossierSync(job.id);
 expect(job.entries.every(e=>e.status==='synced')).toBe(true);for(const e of job.entries){const remote=r.files.get(e.fileId!);expect(remote.md5Checksum).toBe(e.md5);expect(remote.bytes.equals(fs.readFileSync(path.join(root,e.relativePath)))).toBe(true);}
 const count=r.create.mock.calls.length;job=prepareDossierSync();while(job.cursor<job.queue.length)job=await advanceDossierSync(job.id);expect(r.create).toHaveBeenCalledTimes(count);expect(job.entries.filter(e=>e.mime==='text/csv')).toHaveLength(1);
});
