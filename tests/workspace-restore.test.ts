import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {db,writeDraft,removeDraft,readDraft,listDrafts,getSetting,setSetting} from '../src/lib/db';
import {newBudget} from '../src/lib/budget';
import {saveBudgetRecord,listBudgets} from '../src/lib/budget-db';
import {newDraft} from '../src/lib/document';
import {storeSignedScan,readSignedScan} from '../src/lib/signed-scans';
import {setStorage,exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-restore-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');setSetting('google:token','keep-token');setSetting('organization','keep-organization');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const draft=(subject:string)=>({...newDraft(),subject});
it('restores business data with a safety backup, keeps settings, and rejects stale editor versions',async()=>{
 const first=writeDraft(draft('ก่อนสำรอง'));db().exec('CREATE TABLE document_attachments(id TEXT PRIMARY KEY,name TEXT NOT NULL,pages INTEGER NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL,original BLOB,original_name TEXT)');
 db().prepare('INSERT INTO document_attachments VALUES(?,?,?,?,?,?,?)').run('attachment-test','test.pdf',1,Buffer.from('%PDF-backup'),'2026-01-01T00:00:00.000Z',Buffer.from('original'),'original.txt');
 const backup=exportWorkspace();const edited=writeDraft(draft('แก้หลังสำรอง'),first.id,first.version);writeDraft(draft('สร้างหลังสำรอง'));
 const preview=await prepareBackupRestore(path.basename(backup.folder));expect(preview.currentCounts.documents).toBe(2);expect(preview.counts.documents).toBe(1);
 expect(()=>activateBackupRestore(preview.token,'wrong')).toThrow();expect(listDrafts()).toHaveLength(2);
 const restored=activateBackupRestore(preview.token,'กู้คืนข้อมูล');
 expect(listDrafts()).toHaveLength(1);expect(readDraft(first.id).subject).toBe('ก่อนสำรอง');expect(readDraft(first.id).version).toBeGreaterThan(edited.version);
 expect(()=>writeDraft(draft('stale'),first.id,edited.version)).toThrow();expect(getSetting('google:token')).toBe('keep-token');expect(getSetting('organization')).toBe('keep-organization');
 expect(Buffer.from(db().prepare('SELECT file FROM document_attachments').get()!.file as Uint8Array).toString()).toBe('%PDF-backup');
 const safety=new DatabaseSync(path.join(restored.safetyBackup,'sarabun.sqlite'),{readOnly:true});try{expect(safety.prepare('SELECT count(*) n FROM documents').get()!.n).toBe(2);}finally{safety.close();}
 expect(()=>activateBackupRestore(preview.token,'กู้คืนข้อมูล')).toThrow();
});
it('requires a fresh preview when a user edits data after preview',async()=>{
 const first=writeDraft(draft('สำรอง'));const backup=exportWorkspace();const preview=await prepareBackupRestore(path.basename(backup.folder));
 writeDraft(draft('ล่าสุดห้ามหาย'),first.id,first.version);
 expect(()=>activateBackupRestore(preview.token,'กู้คืนข้อมูล')).toThrow(/เปลี่ยน/);expect(readDraft(first.id).subject).toBe('ล่าสุดห้ามหาย');
});
it('rolls back the entire restore if an insert fails after deleting current rows',async()=>{
 const first=writeDraft(draft('สำรอง'));const backup=exportWorkspace();writeDraft(draft('ปัจจุบัน'),first.id,first.version);
 db().exec("CREATE TRIGGER reject_restore BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT,'forced test failure'); END");
 const preview=await prepareBackupRestore(path.basename(backup.folder));expect(()=>activateBackupRestore(preview.token,'กู้คืนข้อมูล')).toThrow(/forced test failure/);expect(readDraft(first.id).subject).toBe('ปัจจุบัน');expect(db().prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
});
it('rejects changed staged files and backup triggers even with a matching manifest hash',async()=>{
 writeDraft(draft('สำรอง'));const backup=exportWorkspace();const preview=await prepareBackupRestore(path.basename(backup.folder));fs.appendFileSync(preview.database,'changed');
 expect(()=>activateBackupRestore(preview.token,'กู้คืนข้อมูล')).toThrow(/ไฟล์สำรองเปลี่ยน/);
 const file=path.join(backup.folder,'sarabun.sqlite'),source=new DatabaseSync(file);source.exec("CREATE TRIGGER malicious AFTER INSERT ON documents BEGIN DELETE FROM documents; END");source.close();
 const manifestPath=path.join(backup.folder,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest.files.find((entry:{name:string})=>entry.name==='sarabun.sqlite').sha256=createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 await expect(prepareBackupRestore(path.basename(backup.folder))).rejects.toThrow(/คำสั่งฐานข้อมูล/);expect(listDrafts()).toHaveLength(1);
});

it('restores legacy budgets whose generated letter was deleted, retaining the entire request',async()=>{
 const budget=saveBudgetRecord(newBudget('2026-10-08'));db().prepare('UPDATE budget_transfers SET document_id=?,generated_version=1 WHERE id=?').run('deleted-document',budget.id);
 const backup=exportWorkspace();const preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');
 const restored=listBudgets()[0];expect(restored.data).toEqual(budget.data);expect(restored.documentId).toBeNull();expect(restored.version).toBeGreaterThan(budget.version);
});
it('deleting a generated letter detaches its budget and protects against stale budget edits',()=>{
 const letter=writeDraft(draft('ลบเฉพาะหนังสือ')),budget=saveBudgetRecord(newBudget('2026-10-08'));
 db().prepare('UPDATE budget_transfers SET document_id=?,generated_version=1 WHERE id=?').run(letter.id,budget.id);
 removeDraft(letter.id,letter.version);const retained=listBudgets()[0];expect(retained.documentId).toBeNull();expect(retained.data).toEqual(budget.data);expect(retained.version).toBe(budget.version+1);
 expect(()=>saveBudgetRecord(budget.data,budget.id,budget.version)).toThrow();
});

it('restores the signed original alongside its draft',async()=>{
 const original=writeDraft(draft('หนังสือลงนาม'));
 const scan=await storeSignedScan(original.id,new File([new Uint8Array(Buffer.from('%PDF-1.4\n%%EOF'))],'signed.pdf',{type:'application/pdf'}));
 const backup=exportWorkspace();
 db().prepare('DELETE FROM signed_scans WHERE id=?').run(scan.id);
 const preview=await prepareBackupRestore(path.basename(backup.folder));
 activateBackupRestore(preview.token,'กู้คืนข้อมูล');
 expect(readDraft(original.id).signedScanCount).toBe(1);
 expect(readSignedScan(scan.id).file.toString()).toBe('%PDF-1.4\n%%EOF');
});
