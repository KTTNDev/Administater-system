import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {afterEach,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {planDataMove,migrateDataLocation} from '../scripts/migrate-data-location.mjs';
import {resolveDatabaseFile} from '../scripts/data-location.mjs';
import {documentDossier,saveDocumentOutput,fiscalFolder,inside,copyWorkspaceFiles} from '../scripts/workspace-files.mjs';
const connections:DatabaseSync[]=[];
afterEach(()=>{for(const c of connections.splice(0))c.close();});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-location-')),sourceRoot=path.join(root,'program'),localFolder=path.join(root,'old-files'),target=path.join(root,'new-files'),database=path.join(sourceRoot,'data','main.sqlite');
 fs.mkdirSync(path.dirname(database),{recursive:true});fs.mkdirSync(localFolder);fs.writeFileSync(path.join(sourceRoot,'.env.local'),'# preserve settings\nSESSION_SECRET="fixture-only"\nDATABASE_PATH="data/main.sqlite"\n');
 const db=new DatabaseSync(database);connections.push(db);db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE documents(id TEXT PRIMARY KEY,data TEXT,version INTEGER,deleted_at TEXT);CREATE TABLE document_attachments(id TEXT PRIMARY KEY,name TEXT,file BLOB,original BLOB,original_name TEXT);CREATE TABLE document_appendix_images(id TEXT PRIMARY KEY,name TEXT,file BLOB);CREATE TABLE signed_scans(id TEXT PRIMARY KEY,document_id TEXT,name TEXT,file BLOB);`);
 db.prepare('INSERT INTO documents VALUES(?,?,1,NULL)').run('doc-one',JSON.stringify({type:'internal',date:'2026-10-01',subject:'เรื่อง/เดียวกัน',attachmentFiles:[{id:'a'}],appendixImages:[{id:'i'}],floatingItems:[{kind:'image',image:{id:'i'}}]}));
 db.prepare('INSERT INTO document_attachments VALUES(?,?,?,?,?)').run('a','ต้นฉบับ.pdf',Buffer.from('converted'),Buffer.from('original'),'ต้นฉบับ.png');db.prepare('INSERT INTO document_appendix_images VALUES(?,?,?)').run('i','ภาพ.png',Buffer.from('picture'));db.prepare('INSERT INTO signed_scans VALUES(?,?,?,?)').run('s','doc-one','ลงนาม.pdf',Buffer.from('signed'));
 return {sourceRoot,localFolder,target,database,db,root};
}
it('groups references, deduplicates images, preserves original bytes and moves renamed subjects',()=>{
 const f=fixture(),one=documentDossier(f.db,f.localFolder,'doc-one');expect(one.files).toBe(4);expect(one.missing).toEqual([]);expect(one.folder).toContain(path.join('หนังสือราชการ','หนังสือภายใน','ปีงบประมาณ 2570'));
 const m=JSON.parse(fs.readFileSync(path.join(one.folder,'รายการไฟล์.json'),'utf8'));for(const [kind,bytes] of [['attachment','converted'],['original','original'],['image','picture'],['signed','signed']]){const entry=m.files.find((x:{kind:string})=>x.kind===kind);expect(fs.readFileSync(path.join(one.folder,entry.path),'utf8')).toBe(bytes);}
 const output=saveDocumentOutput(f.db,f.localFolder,'doc-one',1,'pdf',Buffer.from('rendered'));const d=JSON.parse(String(f.db.prepare('SELECT data FROM documents').get()!.data));d.subject='ชื่อใหม่';f.db.prepare('UPDATE documents SET data=?,version=2').run(JSON.stringify(d));const two=documentDossier(f.db,f.localFolder,'doc-one');expect(fs.existsSync(one.folder)).toBe(false);expect(fs.existsSync(path.join(two.folder,'เอกสาร',path.basename(output)))).toBe(true);
 f.db.prepare('UPDATE documents SET deleted_at=?').run('today');expect(documentDossier(f.db,f.localFolder,'doc-one').folder).toContain('ถังขยะ');
});
it('uses the Thai fiscal year boundary and rejects path traversal',()=>{expect(fiscalFolder('2026-09-30')).toBe('ปีงบประมาณ 2569');expect(fiscalFolder('2026-10-01')).toBe('ปีงบประมาณ 2570');expect(()=>inside(os.tmpdir(),'../outside')).toThrow();});
it('moves WAL data, copies backup databases, preserves configuration and retires the original database',()=>{
 const f=fixture();fs.mkdirSync(path.join(f.localFolder,'สำรองข้อมูล'));fs.writeFileSync(path.join(f.localFolder,'สำรองข้อมูล','backup.sqlite'),'backup-bytes');
 const plan=planDataMove(f),result=migrateDataLocation({...f,configurationHash:plan.configurationHash});expect(result.files).toBe(1);expect(resolveDatabaseFile(f.sourceRoot,f.database)).toBe(result.database);
 const restarted=spawnSync(process.execPath,['--input-type=module','-e', 'import {resolveDatabaseFile} from '+JSON.stringify(pathToFileURL(path.resolve('scripts/data-location.mjs')).href)+';console.log(resolveDatabaseFile(process.env.CASE_ROOT,process.env.CASE_DB));'],{encoding:'utf8',env:{...process.env,CASE_ROOT:f.sourceRoot,CASE_DB:f.database}});expect(restarted.status,restarted.stderr).toBe(0);expect(restarted.stdout.trim()).toBe(result.database);
 const copy=new DatabaseSync(result.database);connections.push(copy);expect(copy.prepare('SELECT COUNT(*) n FROM documents').get()!.n).toBe(1);expect(Buffer.from(copy.prepare('SELECT file FROM signed_scans').get()!.file as Uint8Array).toString()).toBe('signed');expect(fs.readFileSync(path.join(f.target,'สำรองข้อมูล','backup.sqlite'),'utf8')).toBe('backup-bytes');
 expect(()=>f.db.prepare('UPDATE documents SET version=3').run()).toThrow(/ย้ายแล้ว/);expect(()=>f.db.prepare('DELETE FROM settings').run()).toThrow(/ย้ายแล้ว/);copy.prepare('UPDATE documents SET version=3').run();expect(fs.readFileSync(path.join(f.sourceRoot,'.env.local'),'utf8')).toContain('SESSION_SECRET="fixture-only"');expect(fs.readFileSync(path.join(f.sourceRoot,'.env.local'),'utf8')).toContain('DATABASE_REQUIRE_EXISTING=true');
 const saved=new DatabaseSync(path.join(result.checkpoint,'original.sqlite'));connections.push(saved);expect(saved.prepare("SELECT value FROM settings WHERE key='storage:relocatedTo'").get()).toBeUndefined();saved.prepare('UPDATE documents SET version=8').run();
});
it('rejects occupied, nested and stale plans without changing the source',()=>{
 const f=fixture();fs.mkdirSync(f.target);fs.writeFileSync(path.join(f.target,'existing'),'safe');expect(()=>planDataMove(f)).toThrow(/ว่าง/);expect(()=>planDataMove({...f,target:path.join(f.localFolder,'nested')})).toThrow(/ซ้อน/);
 const target=path.join(f.root,'empty'),plan=planDataMove({...f,target});fs.appendFileSync(path.join(f.sourceRoot,'.env.local'),'OTHER=true\n');expect(()=>migrateDataLocation({...f,target,configurationHash:plan.configurationHash})).toThrow(/เปลี่ยน/);expect(f.db.prepare('SELECT version FROM documents').get()!.version).toBe(1);
});
it('rolls back cutover when a reference is missing, leaving the original writable',()=>{
 const f=fixture();f.db.prepare('DELETE FROM document_appendix_images').run();const plan=planDataMove(f);expect(()=>migrateDataLocation({...f,configurationHash:plan.configurationHash})).toThrow(/ไม่ครบ/);expect(f.db.prepare("SELECT value FROM settings WHERE key='storage:relocatedTo'").get()).toBeUndefined();f.db.prepare('UPDATE documents SET version=7').run();expect(fs.readFileSync(path.join(f.sourceRoot,'.env.local'),'utf8')).not.toContain('DATABASE_REQUIRE_EXISTING');
});
it('fails closed if the chosen database is absent, and detects redirect cycles',()=>{
 const f=fixture();expect(()=>resolveDatabaseFile(f.sourceRoot,'missing.sqlite',true)).toThrow(/ไม่พบ/);f.db.prepare('INSERT INTO settings VALUES(?,?)').run('storage:relocatedTo',f.database);expect(()=>resolveDatabaseFile(f.sourceRoot,f.database)).toThrow(/วนซ้ำ/);f.db.prepare('UPDATE settings SET value=?').run(path.join(f.root,'missing.sqlite'));expect(()=>resolveDatabaseFile(f.sourceRoot,f.database)).toThrow(/ไม่พบ/);
});

it('portable archive retains exports and backups but excludes the active database directory',()=>{
 const f=fixture();documentDossier(f.db,f.localFolder,'doc-one');saveDocumentOutput(f.db,f.localFolder,'doc-one',1,'docx',Buffer.from('editable-word'));
 fs.mkdirSync(path.join(f.localFolder,'ฐานข้อมูล'));fs.writeFileSync(path.join(f.localFolder,'ฐานข้อมูล','sarabun.sqlite'),'must-not-copy');fs.mkdirSync(path.join(f.localFolder,'สำรองข้อมูล'));fs.writeFileSync(path.join(f.localFolder,'สำรองข้อมูล','copy.sqlite'),'keep-backup');
 const count=copyWorkspaceFiles(f.localFolder,f.target,f.database);expect(count).toBeGreaterThan(5);expect(fs.existsSync(path.join(f.target,'ฐานข้อมูล'))).toBe(false);expect(fs.readFileSync(path.join(f.target,'สำรองข้อมูล','copy.sqlite'),'utf8')).toBe('keep-backup');
 const index=JSON.parse(fs.readFileSync(path.join(f.target,'.sarabun-file-index.json'),'utf8')),folder=path.join(f.target,index.folders['document:doc-one'],'เอกสาร'),word=fs.readdirSync(folder).find(n=>n.endsWith('.docx'));expect(fs.readFileSync(path.join(folder,word!),'utf8')).toBe('editable-word');
});
it('portable archive refuses nested destinations and overwriting existing files',()=>{
 const f=fixture();fs.writeFileSync(path.join(f.localFolder,'note.txt'),'source');expect(()=>copyWorkspaceFiles(f.localFolder,path.join(f.localFolder,'copy'))).toThrow();fs.mkdirSync(f.target);fs.writeFileSync(path.join(f.target,'note.txt'),'personal');expect(()=>copyWorkspaceFiles(f.localFolder,f.target)).toThrow();expect(fs.readFileSync(path.join(f.target,'note.txt'),'utf8')).toBe('personal');
});
