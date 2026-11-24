import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {newProcurement,procurementSchema,d01Values} from '../src/lib/procurement';
import {applyReservation,type Reservation} from '../src/lib/procurement-register';
import {saveProcurement,readProcurement} from '../src/lib/procurement-db';
import {db,writeDraft} from '../src/lib/db';import {documentSchema} from '../src/lib/document';
import {emptyDocumentConfig} from '../src/lib/procurement-workflow-model';
const entry=(patch:Partial<Reservation>={}):Reservation=>({id:randomUUID(),code:'D01',register:'internal',owner:'หน่วยงานทดสอบ',prefix:'ทดสอบ 99',year:2569,number:'1465',plannedDate:'2026-11-17',confirmedDate:'',status:'reserved',printNumber:true,recordedAt:'',note:'',...patch});
beforeEach(()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-ledger-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'test.sqlite'));vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');vi.stubEnv('SARABUN_SOURCE_DIR',folder);});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
it('opens a skeleton before a bill, separates reservation from approval and binds dates without marking an event',()=>{
 const e=entry(),data=newProcurement();data.title='จองเลขก่อนบิล';data.register.entries=[e];const bound=applyReservation(data,e),saved=saveProcurement(bound);
 expect(saved.bill.items).toHaveLength(0);expect(saved.workflow.state).toBe('preparing');expect(saved.workflow.events).toHaveLength(0);
 expect(saved.register.entries[0].recordedAt).toMatch(/^20/);expect(saved.register.entries[0].confirmedDate).toBe('');expect(d01Values(saved).number).toBe('ทดสอบ 99/1465');expect(d01Values(saved).day).toBe('17');
});
it('normalizes Thai digits, isolates register types and keeps cancelled numbers unavailable',()=>{
 const e=entry(),data=newProcurement();data.title='งานแรก';data.register.entries=[e];let first=saveProcurement(data);
 const other=newProcurement();other.title='งานสอง';other.register.entries=[entry({number:'๑๔๖๕'})];expect(()=>saveProcurement(other)).toThrow(/งานอื่น/);
 other.register.entries=[entry({code:'D08',register:'announcement',number:'๑๔๖๕',printNumber:false})];expect(saveProcurement(other).title).toBe('งานสอง');
 const {id:_id,version:_v,updatedAt:_at,...input}=first;first=saveProcurement({...input,register:{...first.register,entries:first.register.entries.map(row=>({...row,status:'cancelled' as const,note:'จองผิด'}))}},first.id,first.version);
 const second=newProcurement();second.title='ห้ามใช้เลขเดิม';second.register.entries=[entry()];expect(()=>saveProcurement(second)).toThrow(/ยกเลิก/);
});
it('records changes, requires cancelling an existing number and prevents deletion or reactivation of history',()=>{
 const data=newProcurement();data.title='ประวัติ';data.register.entries=[entry()];const first=saveProcurement(data),{id,version,updatedAt:_at,...input}=first;
 expect(()=>saveProcurement({...input,register:{...input.register,entries:[]}},id,version)).toThrow(/ห้ามลบ/);
 expect(()=>saveProcurement({...input,register:{...input.register,entries:input.register.entries.map(e=>({...e,number:'999'}))}},id,version)).toThrow(/ยกเลิก/);
 expect(()=>saveProcurement({...input,register:{...input.register,entries:input.register.entries.map(e=>({...e,status:'used',confirmedDate:''}))}},id,version)).toThrow(/วันที่/);
 expect(readProcurement(id).version).toBe(version);
});
it('keeps announcement registry metadata separate from the printed winner notification number',()=>{
 const data=newProcurement();data.title='ทะเบียนแยก';const announcement=entry({code:'D08',register:'announcement',number:'78',printNumber:false}),notice=entry({code:'N01',register:'external',number:'4511'});data.register.entries=[announcement,notice];
 const bound=applyReservation(applyReservation(data,announcement),notice);expect(bound.documents.D08?.number).toBe('');expect(bound.documents.N01?.number).toBe('ทดสอบ 99/4511');
});
it('protects the first packet while allowing only payment approval and voucher changes after finance returns',()=>{
 const data=newProcurement();data.title='ทดสอบชุดตรึง';data.workflow.state='returned_for_voucher';const first=saveProcurement(data,undefined,undefined,true),{id,version,updatedAt:_at,...input}=first;
 const changed=saveProcurement({...input,documents:{...input.documents,D14:{...emptyDocumentConfig(),number:'ทดสอบ/200',date:'2026-11-17'}}},id,version);
 expect(changed.documents.D14?.number).toBe('ทดสอบ/200');
 expect(()=>saveProcurement({...input,common:{...input.common,vendor:'เปลี่ยนร้าน'}},id,changed.version)).toThrow(/ตรึง/);
 expect(()=>saveProcurement({...input,documents:{...input.documents,D12:{...emptyDocumentConfig(),primaryFileId:'เปลี่ยนชุดแรก'}}},id,changed.version)).toThrow(/ตรึง/);
});
it('prevents collisions with the normal letter register in both directions',()=>{
 const normal=documentSchema.parse({type:'internal',subject:'หนังสือทดสอบ',organization:'หน่วยงานทดสอบ',number:'ทดสอบ 99/๒๐๐',date:'2026-11-17'});writeDraft(normal);
 const data=newProcurement();data.title='ชนเลขเดิม';data.register.entries=[entry({number:'200'})];expect(()=>saveProcurement(data)).toThrow(/สารบรรณ/);
 data.register.entries=[entry({number:'201'})];saveProcurement(data);expect(()=>writeDraft({...normal,number:'ทดสอบ 99/๒๐๑'})).toThrow(/ลายแทง/);
});
it('reads old cases with an empty ledger without changing their original content',()=>{const data=newProcurement(),{register:_ledger,...legacy}=data;legacy.title='งานเก่า';const before=JSON.stringify(legacy);expect(procurementSchema.parse(legacy).register.entries).toHaveLength(0);expect(JSON.stringify(legacy)).toBe(before);});
