import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {saveRegister,listRegister,readRegister,registerHistory} from '../src/lib/correspondence-db';
import {newRegister,filterRegister,fiscalRange,fiscalYear,registerStats,registerSchema} from '../src/lib/correspondence';
import {csv,registerCsv,registerHtml} from '../src/lib/correspondence-export';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-register-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'test.sqlite'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const input=()=>({...newRegister('กองช่าง'),registeredDate:'2026-10-20',registeredTime:'08:32',documentDate:'2026-10-19',from:'สำนักงานจังหวัด',to:'กองช่าง',subject:'ตรวจสอบกล้องวงจรปิด',number:'ภก 123/๗๘'});
const command=()=>({input:input(),actor:'สมชาย ผู้รับ',requestId:randomUUID()});
it('allocates atomically per calendar year, direction and department, continuing an existing book',()=>{
 const a=saveRegister({...command(),startNumber:120});expect(a.serial).toBe(120);expect(a.year).toBe(2026);
 expect(saveRegister({...command(),startNumber:900}).serial).toBe(121);
 expect(saveRegister({...command(),input:{...input(),direction:'outgoing'}}).serial).toBe(1);
 expect(saveRegister({...command(),input:{...input(),department:'กองคลัง'}}).serial).toBe(1);
 expect(saveRegister({...command(),input:{...input(),registeredDate:'2027-01-01'}}).serial).toBe(1);
});
it('retries a create without duplicating the record or audit stamp',()=>{const c=command(),a=saveRegister(c);expect(saveRegister(c).id).toBe(a.id);expect(listRegister()).toHaveLength(1);expect(registerHistory(a.id)).toHaveLength(1);});
it('preserves original operator and snapshots, rejects stale writes and does not recycle cancelled numbers',()=>{
 const a=saveRegister(command());const b=saveRegister({...command(),id:a.id,version:a.version,input:{...a,status:'working',owner:'ผู้รับผิดชอบใหม่'},actor:'มาลี',reason:'มอบหมายงาน'});
 expect(b.createdBy).toBe(a.createdBy);expect(b.createdAt).toBe(a.createdAt);expect(b.updatedBy).toBe('มาลี');
 expect(()=>saveRegister({...command(),id:a.id,version:a.version,reason:'ข้อมูลเก่า'})).toThrow(/ถูกแก้ไข/);
 const cancelled=saveRegister({...command(),id:b.id,version:b.version,input:{...b,status:'cancelled'},reason:'บันทึกซ้ำจากเล่มเดิม'});
 expect(saveRegister(command()).serial).toBe(2);expect(registerHistory(a.id).map(h=>h.snapshot.status)).toEqual(['new','working','cancelled']);expect(readRegister(cancelled.id).status).toBe('cancelled');
});
it('requires actor, valid dates, linked references and reasons, and prevents changing issued book identity',()=>{
 expect(()=>saveRegister({...command(),actor:' '})).toThrow();expect(registerSchema.safeParse({...input(),registeredDate:'2026-02-30'}).success).toBe(false);
 expect(()=>saveRegister({...command(),input:{...input(),documentId:randomUUID()}})).toThrow(/ร่างหนังสือ/);
 expect(()=>saveRegister({...command(),input:{...input(),relatedId:randomUUID()}})).toThrow(/อ้างอิง/);
 const a=saveRegister(command());expect(()=>saveRegister({...command(),input:a,id:a.id,version:a.version})).toThrow(/เหตุผล/);
 for(const change of [{department:'กองคลัง'},{direction:'outgoing'},{registeredDate:'2027-01-01'}])expect(()=>saveRegister({...command(),id:a.id,version:a.version,reason:'แก้',input:{...a,...change}})).toThrow(/เปลี่ยนกอง/);
});
it('filters fiscal boundaries and Thai digits, dates and operators; counts cancelled separately',()=>{
 saveRegister({...command(),input:{...input(),registeredDate:'2026-09-30'}});saveRegister(command());saveRegister({...command(),input:{...input(),registeredDate:'2027-09-30',direction:'outgoing',status:'done'}});saveRegister({...command(),input:{...input(),registeredDate:'2027-10-01'}});
 const selected=filterRegister(listRegister(),fiscalRange(2570));expect(selected).toHaveLength(2);expect(fiscalYear('2026-09-30')).toBe(2569);expect(fiscalYear('2026-10-01')).toBe(2570);
 expect(filterRegister(selected,{query:'123/78 สมชาย'})).toHaveLength(2);expect(filterRegister(selected,{query:'20/10/2569'})).toHaveLength(1);
 const sums=registerStats(selected);expect(sums.map(s=>s.month)).toEqual(['2026-10','2027-09']);expect(sums[1].done).toBe(1);
 expect(registerStats([{...selected[0],status:'cancelled'}])[0]).toMatchObject({incoming:0,outgoing:0,cancelled:1});
});
it('exports safe CSV and escaped print content without altering actual data',()=>{
 const a=saveRegister({...command(),input:{...input(),subject:'=HYPERLINK("x")',notes:'<script>bad()</script>'}});
 expect(csv([['  +SUM(1,2)','ordinary','a"b']])).toContain('"\'  +SUM(1,2)"');expect(registerCsv([a])).toContain('"\'=HYPERLINK');
 const html=registerHtml([a],{mode:'book',description:'<bad>',font:'',bold:''});expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('เลขทะเบียนรับ');expect(readRegister(a.id).subject).toBe('=HYPERLINK("x")');
});
