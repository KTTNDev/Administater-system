import {it,expect,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {prepareReportOutput,saveReportOutput,readReportMetadata,reportOutputState} from '../scripts/report-files.mjs';
import {buildDossierSyncPlan,dossierOwnerSnapshot} from '../scripts/dossier-sync-plan.mjs';
import {copyWorkspaceFiles} from '../scripts/workspace-files.mjs';
import {planDataMove,migrateDataLocation} from '../scripts/migrate-data-location.mjs';
const connections:DatabaseSync[]=[];afterEach(()=>{for(const c of connections.splice(0))c.close();});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-report-files-')),sourceRoot=path.join(root,'program'),localFolder=path.join(root,'files'),database=path.join(sourceRoot,'data/main.sqlite');fs.mkdirSync(path.dirname(database),{recursive:true});fs.mkdirSync(localFolder);fs.writeFileSync(path.join(sourceRoot,'.env.local'),'DATABASE_PATH="data/main.sqlite"\n');
 const db=new DatabaseSync(database);connections.push(db);db.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE office_items(id TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT);CREATE TABLE project_files(id TEXT PRIMARY KEY,project_id TEXT,task_id TEXT,stage TEXT,caption TEXT,include_report INTEGER,name TEXT,mime TEXT,file BLOB);CREATE TABLE inventory_items(id TEXT PRIMARY KEY,code TEXT,data TEXT,version INTEGER,balance REAL);CREATE TABLE inventory_movements(id TEXT PRIMARY KEY,number TEXT,data TEXT,version INTEGER);CREATE TABLE inventory_form_drafts(id TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT);`);
 db.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run('p',JSON.stringify({kind:'project',title:'โครงการทดสอบ',fiscalYear:2570}),'2026-11-01');db.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run('task',JSON.stringify({kind:'task',title:'เตรียมงาน',projectId:'p'}),'2026-11-01');
 db.prepare('INSERT INTO inventory_items VALUES(?,?,?,?,?)').run('i','วัสดุ1',JSON.stringify({name:'กระดาษ',code:'วัสดุ1'}),1,10);
 db.prepare('INSERT INTO inventory_movements VALUES(?,?,?,1)').run('m','ใบเบิก1',JSON.stringify({number:'ใบเบิก1',date:'2026-11-01'}));
 db.prepare('INSERT INTO inventory_form_drafts VALUES(?,?,1,?)').run('f',JSON.stringify({title:'บัญชีวัสดุ',asOf:'2026-11-01'}),'2026-11-01');
 return {root,sourceRoot,localFolder,database,db,target:path.join(root,'new-files')};
}
const bytes=(v:string)=>Buffer.from(v);
it('files project, movement and form exports under their owners and includes both formats in the Drive plan',()=>{
 const f=fixture();for(const [kind,id,title] of [['project','p','รูปเล่ม'],['inventory-movement','m','ใบเบิก'],['inventory-form','f','แบบฟอร์ม']] as const){const s=prepareReportOutput(f.db,kind,id,title);const pdf=saveReportOutput(f.db,f.localFolder,s,'pdf',bytes(kind+'-pdf'));const word=saveReportOutput(f.db,f.localFolder,s,'docx',bytes(kind+'-word'));expect(path.dirname(pdf)).toBe(path.dirname(word));expect(pdf).toContain('ฉบับส่งออก');expect(pdf).toContain('ปีงบประมาณ 2570');}
 const plan=buildDossierSyncPlan(f.db,f.localFolder);expect(plan.skipped).toEqual([]);expect(plan.entries.filter(e=>/\.(pdf|docx)$/.test(e.name))).toHaveLength(6);expect(plan.entries.some(e=>e.ownerKind==='inventory-form'&&e.name==='ข้อมูลแบบฟอร์ม.json')).toBe(true);
});
it('rejects source changes while rendering and excludes old owner outputs until regenerated',()=>{
 const f=fixture(),s=prepareReportOutput(f.db,'project','p','รูปเล่ม');const file=saveReportOutput(f.db,f.localFolder,s,'pdf',bytes('old'));
 const before=buildDossierSyncPlan(f.db,f.localFolder).entries.find(e=>e.ownerId==='p')!;
 f.db.prepare('UPDATE office_items SET version=2 WHERE id=?').run('task');expect(()=>saveReportOutput(f.db,f.localFolder,s,'docx',bytes('stale'))).toThrow(/เปลี่ยน/);
 const plan=buildDossierSyncPlan(f.db,f.localFolder);expect(plan.entries.some(e=>e.name.endsWith('.pdf'))).toBe(false);expect(plan.skipped.some(e=>/ข้อมูลเปลี่ยน/.test(e.reason))).toBe(true);expect(fs.readFileSync(file,'utf8')).toBe('old');
 expect(dossierOwnerSnapshot(f.db,'project','p',f.localFolder)!.fingerprint).not.toBe(before.ownerFingerprint);
 const current=prepareReportOutput(f.db,'project','p','รูปเล่ม');saveReportOutput(f.db,f.localFolder,current,'docx',bytes('new'));expect(reportOutputState(f.db,f.localFolder,'project','p')!.data.files.map(f=>f.format)).toEqual(['docx']);
});
it('separates report filters, preserves date-range snapshots and assigns CSV MIME correctly',()=>{
 const f=fixture(),context={report:'register',start:'2026-09-01',end:'2026-10-31',query:'กระดาษ'},one=prepareReportOutput(f.db,'inventory-report','','ทะเบียน',context),same=prepareReportOutput(f.db,'inventory-report','','ทะเบียน',{query:'กระดาษ',end:context.end,start:context.start,report:'register'}),other=prepareReportOutput(f.db,'inventory-report','','ทะเบียน',{...context,query:'หมึก'});expect(one.id).toBe(same.id);expect(one.id).not.toBe(other.id);
 const pdf=saveReportOutput(f.db,f.localFolder,one,'pdf',bytes('pdf'));saveReportOutput(f.db,f.localFolder,one,'csv',bytes('csv'));saveReportOutput(f.db,f.localFolder,other,'csv',bytes('other'));expect(pdf).toContain('ช่วงหลายปีงบประมาณ');
 f.db.prepare('UPDATE inventory_items SET balance=9').run();const plan=buildDossierSyncPlan(f.db,f.localFolder);expect(plan.entries.filter(e=>e.ownerKind==='report'&&e.mime==='text/csv')).toHaveLength(2);expect(plan.entries.some(e=>e.ownerKind==='report'&&e.mime==='application/pdf')).toBe(true);
});
it('keeps old exports when an owner is renamed and prevents overwriting externally edited files',()=>{
 const f=fixture(),s=prepareReportOutput(f.db,'inventory-form','f','บัญชี'),old=saveReportOutput(f.db,f.localFolder,s,'pdf',bytes('PDF'));
 expect(saveReportOutput(f.db,f.localFolder,s,'pdf',bytes('PDF'))).toBe(old);fs.writeFileSync(old,'edited');expect(()=>saveReportOutput(f.db,f.localFolder,s,'pdf',bytes('PDF'))).toThrow(/ไม่เขียนทับ/);
 expect(buildDossierSyncPlan(f.db,f.localFolder).skipped.some(e=>/ภายนอก/.test(e.reason))).toBe(true);
 f.db.prepare('UPDATE inventory_form_drafts SET data=?,version=2 WHERE id=?').run(JSON.stringify({title:'ชื่อใหม่',asOf:'2026-11-01'}),'f');const next=prepareReportOutput(f.db,'inventory-form','f','บัญชี'),newFile=saveReportOutput(f.db,f.localFolder,next,'pdf',bytes('NEW'));expect(newFile).toContain('ชื่อใหม่');expect(fs.existsSync(old)).toBe(false);expect(fs.readFileSync(path.join(path.dirname(newFile),path.basename(old)),'utf8')).toBe('edited');
});
it('carries reports, source metadata and Drive identities in a portable file copy',()=>{
 const f=fixture();for(const [kind,id] of [['project','p'],['inventory-form','f'],['inventory-report','']] as const){const s=prepareReportOutput(f.db,kind,id,'รายงาน',{report:'register',start:'2026-10-01',end:'2026-11-01'});saveReportOutput(f.db,f.localFolder,s,'pdf',bytes(kind));}
 const before=buildDossierSyncPlan(f.db,f.localFolder);copyWorkspaceFiles(f.localFolder,f.target,f.database);const after=buildDossierSyncPlan(f.db,f.target);expect(after.entries.map(e=>e.key)).toEqual(before.entries.map(e=>e.key));for(const e of after.entries)expect(fs.readFileSync(path.join(f.target,e.relativePath))).toEqual(fs.readFileSync(path.join(f.localFolder,e.relativePath)));
});
it('moves the database and report folders together and validates the migrated export bytes',()=>{
 const f=fixture(),s=prepareReportOutput(f.db,'inventory-report','','ทะเบียน',{report:'register',start:'2026-10-01',end:'2026-11-01'}),file=saveReportOutput(f.db,f.localFolder,s,'csv',bytes('migration-report'));
 const plan=planDataMove(f),result=migrateDataLocation({...f,configurationHash:plan.configurationHash});const migrated=new DatabaseSync(result.database);connections.push(migrated);const entries=buildDossierSyncPlan(migrated,f.target).entries.filter(e=>e.mime==='text/csv');expect(entries).toHaveLength(1);expect(fs.readFileSync(path.join(f.target,entries[0].relativePath),'utf8')).toBe('migration-report');expect(fs.readFileSync(file,'utf8')).toBe('migration-report');
});
