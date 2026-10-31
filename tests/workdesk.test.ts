import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db,auditHistory} from '../src/lib/db';
import {writeOffice,listOffice,copyAnnualOffice,deleteOffice} from '../src/lib/office-db';
import {activeTasks,dailyTasks,taskSort,bangkokDay,fiscalYearOf,fiscalBounds,projectProgress,projectStarters,safeCsv,shiftAnnualDate} from '../src/lib/workdesk';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-workdesk-test-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(directory,'test.sqlite')});afterAll(()=>db().close());
const read=(id:string)=>listOffice().find(i=>i.id===id)!;
it('uses Bangkok dates, fiscal October boundary, and safe leap-day rollover',()=>{
 expect(bangkokDay(new Date('2026-09-30T18:00:00Z'))).toBe('2026-10-01');expect(fiscalYearOf('2026-09-30')).toBe(2569);expect(fiscalYearOf('2026-10-01')).toBe(2570);expect(fiscalBounds(2570)).toEqual({start:'2026-10-01',end:'2027-09-30'});expect(shiftAnnualDate('2028-02-29',1)).toBe('2029-02-28');
});
it('creates starter tasks together and measures actual task completion',()=>{
 const id=writeOffice({kind:'project',title:'ผู้สูงอายุ',fiscalYear:2570,annual:true},undefined,undefined,projectStarters[0].tasks);
 expect(projectProgress(id,listOffice())).toEqual({total:6,done:0,percent:0});const child=listOffice().find(i=>i.projectId===id)!;
 writeOffice({...child,status:'done'},child.id,child.version);expect(projectProgress(id,listOffice()).percent).toBe(17);
 expect(()=>writeOffice({...read(id),status:'done'},id,read(id).version)).toThrow('งานย่อย');expect(()=>deleteOffice(id,read(id).version)).toThrow('งานย่อย');
 expect(auditHistory(child.id).length).toBe(2);
});
it('validates project references, fiscal years, dates and edit versions',()=>{
 expect(()=>writeOffice({kind:'project',title:'ไม่มีปี'})).toThrow('ปีงบประมาณ');expect(()=>writeOffice({kind:'task',title:'ย้อนวัน',date:'2026-10-31',due:'2026-10-01'})).toThrow('กำหนดเสร็จ');
 expect(()=>writeOffice({kind:'task',title:'ไม่พบ',projectId:'00000000-0000-4000-8000-999999999999'})).toThrow('ไม่พบโครงการ');
 const id=writeOffice({kind:'task',title:'เวอร์ชัน'});writeOffice({...read(id),status:'done'},id,1);expect(()=>writeOffice({...read(id),status:'new'},id,1)).toThrow('ข้อมูลเปลี่ยน');
});
it('rolls a project and tasks into the next year once, without approved state or document references',()=>{
 const id=writeOffice({kind:'project',title:'งานรายปี',fiscalYear:2571,annual:true,date:'2028-02-29',due:'2028-03-01',number:'เก่า',url:'https://example.com/old'});
 const task=writeOffice({kind:'task',title:'เตรียมงาน',projectId:id,date:'2028-02-29',due:'2028-03-01',status:'done'});
 const created=copyAnnualOffice(id,1);expect(copyAnnualOffice(id,1)).toBe(created);
 const next=read(created),children=listOffice().filter(i=>i.projectId===created);expect(next.fiscalYear).toBe(2572);expect(next.date).toBe('2029-02-28');expect(next.status).toBe('new');expect(next.number).toBe('');expect(next.url).toBe('');expect(children).toHaveLength(1);expect(children[0].status).toBe('new');expect(children[0].fiscalYear).toBe(2572);expect(children[0].originId).toBe(task);
 const again=copyAnnualOffice(created,1);expect(read(again).fiscalYear).toBe(2573);expect(listOffice().filter(i=>i.originId===id)).toHaveLength(2);
});
it('archives a project without deleting tasks and restores its active tasks',()=>{
 const p=writeOffice({kind:'project',title:'พักไว้',fiscalYear:2570});const t=writeOffice({kind:'task',title:'ยังอยู่',projectId:p});writeOffice({...read(p),archived:true},p,1);
 expect(read(t)).toBeTruthy();expect(activeTasks(listOffice()).some(i=>i.id===t)).toBe(false);expect(()=>writeOffice({...read(t),status:'done'},t,1)).toThrow('เปิดโครงการ');writeOffice({...read(p),archived:false},p,2);expect(activeTasks(listOffice()).some(i=>i.id===t)).toBe(true);
});
it('rolls back every starter task if one is invalid',()=>{const before=listOffice().length;expect(()=>writeOffice({kind:'project',title:'ไม่สมบูรณ์',fiscalYear:2570},undefined,undefined,['ถูกต้อง',''])).toThrow();expect(listOffice()).toHaveLength(before)});
it('exports real UTF-8 BOM and spreadsheet-safe values',()=>{const csv=safeCsv([['ชื่อ','จำนวน'],['=1+1',2],['ชื่อ,ทดสอบ',3]]);expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain(String.fromCharCode(34,39)+'=1+1'+String.fromCharCode(34));expect(csv.split(String.fromCharCode(13,10))).toHaveLength(3)});

it('changing project year updates children and invalidates their stale versions',()=>{const p=writeOffice({kind:'project',title:'แก้ปี',fiscalYear:2570});const t=writeOffice({kind:'task',title:'ตามโครงการ',projectId:p});writeOffice({...read(p),fiscalYear:2571},p,1);expect(read(t).fiscalYear).toBe(2571);expect(read(t).version).toBe(2);expect(()=>writeOffice({...read(t),status:'done'},t,1)).toThrow()});
it('keeps completion date when editing a completed task and clears it when reopened',()=>{const id=writeOffice({kind:'task',title:'วันที่ปิดงาน',status:'done'});const date=read(id).completedAt;expect(date).not.toBe('');writeOffice({...read(id),notes:'แก้รายละเอียด'},id,1);expect(read(id).completedAt).toBe(date);writeOffice({...read(id),status:'new'},id,2);expect(read(id).completedAt).toBe('')});
it('cannot create a completed project with unfinished starter tasks',()=>{expect(()=>writeOffice({kind:'project',title:'ปิดก่อนเริ่ม',fiscalYear:2570,status:'done'},undefined,undefined,['ยังไม่เสร็จ'])).toThrow('งานย่อย')});

it('keeps starter steps in order and upcoming-year plans out of today unless already due',()=>{
 const p=writeOffice({kind:'project',title:'แผนปีหน้า',fiscalYear:2571},undefined,undefined,['เริ่ม','ต่อ','จบ']);
 const children=listOffice().filter(i=>i.projectId===p).sort(taskSort);expect(children.map(i=>i.title)).toEqual(['เริ่ม','ต่อ','จบ']);
 expect(dailyTasks(listOffice(),'2027-01-01').some(i=>i.projectId===p)).toBe(false);
 writeOffice({...children[0],due:'2026-12-31'},children[0].id,children[0].version);
 expect(dailyTasks(listOffice(),'2027-01-01').filter(i=>i.projectId===p).map(i=>i.title)).toEqual(['เริ่ม']);
});