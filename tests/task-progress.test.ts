import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {officeSchema} from '../src/lib/office';
import {taskProgress} from '../src/lib/task-progress';
import {db} from '../src/lib/db';
import {writeOffice,listOffice,copyAnnualOffice} from '../src/lib/office-db';
import {setStorage,exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-tracking-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const step=(title:string,done=false)=>({id:randomUUID(),title,done});
const read=(id:string)=>listOffice().find(t=>t.id===id)!;
it('loads legacy tasks without claiming a percentage for working or waiting status',()=>{
 const task=officeSchema.parse({kind:'task',title:'งานเดิม',status:'working'});expect(task.taskTracking).toBe('manual');expect(taskProgress(task).percent).toBe(0);expect(task.taskChecklist).toEqual([]);expect(taskProgress({...task,status:'done'}).percent).toBe(100);
});
it('persists manual progress, next action and blockers, and marks started work as working',()=>{
 const id=writeOffice({kind:'task',title:'ประสานข้อมูล',taskPercent:40,nextStep:'ติดตามข้อมูล',waitingFor:'รอตอบกลับ'});expect(read(id).status).toBe('working');expect(taskProgress(read(id)).percent).toBe(40);
 writeOffice({...read(id),status:'waiting',taskPercent:60},id,1);expect(read(id).status).toBe('waiting');expect(read(id).waitingFor).toBe('รอตอบกลับ');expect(read(id).nextStep).toBe('ติดตามข้อมูล');expect(()=>writeOffice({...read(id),taskPercent:80},id,1)).toThrow();expect(taskProgress(read(id)).percent).toBe(60);
});
it('computes checklist progress and refuses closing unfinished work without changing saved data',()=>{
 const items=[step('รวบรวมข้อมูล',true),step('ตรวจทาน'),step('ส่งรายงาน')];const id=writeOffice({kind:'task',title:'ทำรายงาน',taskTracking:'checklist',taskChecklist:items,taskPercent:99});expect(taskProgress(read(id))).toMatchObject({percent:33,total:3,done:1});
 expect(()=>writeOffice({...read(id),status:'done'},id,1)).toThrow(/รายการย่อยไม่เสร็จ/);expect(read(id).version).toBe(1);expect(read(id).status).toBe('working');
 writeOffice({...read(id),status:'waiting',taskChecklist:items.map(s=>({...s,done:true}))},id,1);expect(taskProgress(read(id)).percent).toBe(100);expect(read(id).status).toBe('waiting');expect(read(id).completedAt).toBe('');
 writeOffice({...read(id),status:'done'},id,2);expect(read(id).completedAt).not.toBe('');
});
it('rejects invalid percentages, blank checklist entries, duplicate ids and excessive checklists',()=>{
 for(const taskPercent of [-1,101,2.5])expect(()=>writeOffice({kind:'task',title:'ทดสอบ',taskPercent})).toThrow();
 expect(()=>writeOffice({kind:'task',title:'ว่าง',taskTracking:'checklist'})).toThrow(/อย่างน้อย 1/);
 expect(()=>writeOffice({kind:'task',title:'ว่าง',taskTracking:'checklist',taskChecklist:[step('')]})).toThrow();
 const same=step('ซ้ำ');expect(()=>writeOffice({kind:'task',title:'ซ้ำ',taskTracking:'checklist',taskChecklist:[same,same]})).toThrow(/ซ้ำ/);
 expect(()=>writeOffice({kind:'task',title:'มากเกิน',taskChecklist:Array.from({length:51},()=>step('ขั้นตอน'))})).toThrow();
});
it('copies annual task structure but resets progress, checkmarks, next action and blockers',()=>{
 const id=writeOffice({kind:'task',title:'งานรายปี',annual:true,fiscalYear:2570,status:'done',taskTracking:'checklist',taskChecklist:[step('ข้อมูล',true),step('ตรวจทาน',true)],taskPercent:80,nextStep:'ส่งรายงาน',waitingFor:'รอลงนาม'});
 const next=read(copyAnnualOffice(id,1));expect(next.taskChecklist.map(s=>s.title)).toEqual(['ข้อมูล','ตรวจทาน']);expect(next.taskChecklist.every(s=>!s.done)).toBe(true);expect(next.status).toBe('new');expect(next.taskPercent).toBe(0);expect(next.nextStep).toBe('');expect(next.waitingFor).toBe('');expect(taskProgress(next).percent).toBe(0);
});
it('preserves progress inside project tasks and still prevents premature project closure',()=>{
 const project=writeOffice({kind:'project',title:'โครงการ',fiscalYear:2570});const child=writeOffice({kind:'task',title:'รายงาน',projectId:project,taskPercent:90});expect(read(child).projectId).toBe(project);expect(()=>writeOffice({...read(project),status:'done'},project,1)).toThrow(/งานย่อยไม่เสร็จ/);expect(taskProgress(read(child)).percent).toBe(90);
});
it('round-trips all tracking fields through existing workspace backup and restore',async()=>{
 const id=writeOffice({kind:'task',title:'งานสำรอง',status:'waiting',taskTracking:'checklist',taskChecklist:[step('รับข้อมูล',true),step('ตรวจ')],nextStep:'โทรติดตาม',waitingFor:'รอรายละเอียด'});const original=read(id);const backup=exportWorkspace();writeOffice({...original,nextStep:'เปลี่ยน'},id,original.version);const preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');expect(read(id)).toMatchObject({taskChecklist:original.taskChecklist,nextStep:'โทรติดตาม',waitingFor:'รอรายละเอียด'});expect(taskProgress(read(id)).percent).toBe(50);expect(read(id).version).toBeGreaterThan(original.version);
});
