import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db,writeDraft,removeDraft,restoreDraft,listTrash,listDrafts,readDraft,reserveDraftNumber,numberHistory,setSetting} from '../src/lib/db';
import {newDraft} from '../src/lib/document';
import {storeSignedScan,readSignedScan} from '../src/lib/signed-scans';
import {exportWorkspace,setStorage} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
import {runAutomaticBackup,configureAutomaticBackup} from '../src/lib/automatic-backup';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-safety-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);fs.mkdirSync(path.join(folder,'scripts'));for(const file of ['restore-backup.mjs','backup-worker.mjs','workspace-backup.mjs'])fs.copyFileSync('scripts/'+file,path.join(folder,'scripts',file));setStorage(path.join(folder,'backups'),'','');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const draft=()=>({...newDraft('external'),date:'2026-10-09',subject:'ทดสอบสำรองและทะเบียน'});
it('restores deleted letters with scans and refuses stale editor writes',async()=>{
 const saved=writeDraft(draft()),bytes=Buffer.from('%PDF-1.4\n%%EOF');
 const scan=await storeSignedScan(saved.id,new File([bytes],'signed.pdf',{type:'application/pdf'}));
 removeDraft(saved.id,saved.version);expect(listDrafts()).toHaveLength(0);expect(listTrash()).toHaveLength(1);expect(()=>readSignedScan(scan.id)).toThrow();
 expect(()=>writeDraft(saved,saved.id,saved.version)).toThrow();expect(()=>restoreDraft(saved.id,saved.version)).toThrow();
 const restored=restoreDraft(saved.id,listTrash()[0].version);expect(readSignedScan(scan.id).file).toEqual(bytes);expect(restored.signedScanCount).toBe(1);expect(listTrash()).toHaveLength(0);expect(()=>writeDraft(saved,saved.id,saved.version)).toThrow();
});
it('rejects Thai/Arabic and spacing variants of an existing number, including trash',async()=>{
 const saved=writeDraft({...draft(),number:'ภก ๕๒๙๐๑/๑'});
 expect(()=>writeDraft({...draft(),number:'ภก52901/1'})).toThrow(/ซ้ำ/);removeDraft(saved.id,saved.version);
 expect(()=>writeDraft({...draft(),number:'ภก52901/0001'})).toThrow(/ซ้ำ/);
 expect(()=>writeDraft({...draft(),number:'ภก 52901 / 1'})).toThrow(/ซ้ำ/);
 expect(writeDraft({...draft(),date:'2027-01-01',number:'ภก52901/1'}).id).toBeTruthy();
});
it('reserves atomically after the highest used number and never reuses a reservation',async()=>{
 writeDraft({...draft(),number:'ภก 52901/๔๐'});
 const a=writeDraft(draft()),b=writeDraft(draft());const reserved=reserveDraftNumber(a.id,a.version,'ภก 52901',1);expect(reserved.number).toBe('ภก 52901/41');
 expect(()=>reserveDraftNumber(a.id,a.version,'ภก 52901',1)).toThrow();
 const edited=writeDraft({...reserved,number:''},reserved.id,reserved.version);removeDraft(edited.id,edited.version);
 expect(reserveDraftNumber(b.id,b.version,'ภก 52901',1).number).toBe('ภก 52901/42');expect(numberHistory()).toHaveLength(2);
 expect(()=>writeDraft({...draft(),number:'ภก52901/41'})).toThrow(/จอง/);
});
it('round-trips trash, scans and reserved numbers in a verified backup',async()=>{
 const saved=writeDraft(draft()),reserved=reserveDraftNumber(saved.id,saved.version,'ภก 123',1);
 const scan=await storeSignedScan(saved.id,new File([Buffer.from('%PDF-1.4\n%%EOF')],'signed.pdf',{type:'application/pdf'}));
 removeDraft(saved.id,reserved.version);const backup=exportWorkspace();restoreDraft(saved.id,listTrash()[0].version);
 const preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');
 expect(listDrafts()).toHaveLength(0);expect(listTrash()).toHaveLength(1);expect(numberHistory()).toHaveLength(1);
 restoreDraft(saved.id,listTrash()[0].version);expect(readSignedScan(scan.id).file.toString()).toContain('%PDF');
});
it('runs once per interval, catches up after downtime and can be disabled',async()=>{
 writeDraft(draft());const now=Date.now(),first=await runAutomaticBackup(false,now);expect(first.error).toBe('');expect(fs.existsSync(path.join(first.folder,'manifest.json'))).toBe(true);
 expect((await runAutomaticBackup(false,now+1000)).folder).toBe(first.folder);
 const second=await runAutomaticBackup(false,now+25*3600000);expect(second.folder).not.toBe(first.folder);
 configureAutomaticBackup(0);expect((await runAutomaticBackup(false,now+10*86400000)).folder).toBe(second.folder);
 expect(()=>configureAutomaticBackup(3)).toThrow();
});
it('keeps the last successful backup on disk failure and retries with backoff',async()=>{
 const now=Date.now(),good=await runAutomaticBackup(false,now),blocked=path.join(folder,'not-a-folder');fs.writeFileSync(blocked,'blocked');setSetting('storage:local',blocked);
 const failed=await runAutomaticBackup(false,now+86400001);expect(failed.error).not.toBe('');expect(failed.lastSuccess).toBe(good.lastSuccess);expect(failed.folder).toBe(good.folder);
 setSetting('storage:local',path.join(folder,'fixed'));expect((await runAutomaticBackup(false,now+86400002)).error).not.toBe('');expect((await runAutomaticBackup(false,now+90000002)).error).toBe('');
});
it('does not start a second backup while another server holds the lease',async()=>{setSetting('backup:auto:lease',String(Date.now()+600000));expect((await runAutomaticBackup(true)).lastSuccess).toBe('');});
it('does not block the application event loop during slow backup I/O',async()=>{
 const worker=path.join(folder,'scripts','backup-worker.mjs');fs.writeFileSync(worker,"Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,700);\n"+fs.readFileSync(worker,'utf8'));
 const job=runAutomaticBackup(true);
 const first=await Promise.race([job.then(()=> 'backup'),new Promise<string>(resolve=>setTimeout(()=>resolve('responsive'),50))]);
 expect(first).toBe('responsive');expect((await job).error).toBe('');
});
