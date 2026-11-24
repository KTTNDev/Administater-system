vi.mock('../src/lib/procurement-preview',()=>({finalizeProcurementWord:async(word:Buffer)=>({word})}));
import {beforeEach,afterEach,it,expect,describe,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';
import {db} from '../src/lib/db';
import {newProcurement,d07Values,procurementWarnings,type ProcurementInput} from '../src/lib/procurement';
import {saveProcurement,readProcurement,procurementSnapshot,procurementHistory,installProcurementTemplate,attachProcurementFile,generateProcurementD07,readProcurementFile} from '../src/lib/procurement-db';
import {setStorage,exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
import {templateSlots} from '../src/lib/procurement-lab/template-model';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-procurement-main-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'main.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const sample=(kind:ProcurementInput['kind']='purchase'):ProcurementInput=>({...newProcurement(kind),title:'งานทดสอบระบบหลัก',common:{...Object.fromEntries(templateSlots.map(f=>[f.key,'ทดสอบ'])),day:'15',month:'พฤศจิกายน',year:'2569',offered:'2,140.00',agreed:'2,140.00',vendor:'ร้านทดสอบระบบ'}});
it('persists separate purchase/hire cases, rejects stale saves and preserves per-document overrides',()=>{
 const purchase=saveProcurement({...sample(),d07Overrides:{subject:'ข้อความเฉพาะ D07'}}),hire=saveProcurement(sample('hire'));
 const changed=saveProcurement({...sample(),common:{...sample().common,subject:'แก้ข้อมูลกลาง'},d07Overrides:purchase.d07Overrides},purchase.id,purchase.version);
 expect(readProcurement(hire.id).kind).toBe('hire');expect(d07Values(changed).subject).toBe('ข้อความเฉพาะ D07');
 expect(()=>saveProcurement(sample(),purchase.id,purchase.version)).toThrow(/อีกหน้าต่าง/);expect(readProcurement(purchase.id).common.subject).toBe('แก้ข้อมูลกลาง');expect(procurementHistory(purchase.id).map(v=>v.version)).toEqual([2,1]);
 expect(newProcurement().common.vendor).toBe('');expect(newProcurement().common.authority).toBe('');
 const derived:ProcurementInput={...sample(),common:{...sample().common,directorRecipient:'',secretaryRecipient:''}};
 expect(d07Values(derived).directorRecipient).toBe(derived.common.secretaryPosition);expect(d07Values({...derived,d07Overrides:{directorRecipient:'เรียนเฉพาะฉบับ'}}).directorRecipient).toBe('เรียนเฉพาะฉบับ');
 const bound:ProcurementInput={...sample(),common:{...sample().common,consideration:'รับราคาจาก {{vendor}} วงเงิน {{agreed}} บาท'}};
 expect(d07Values({...bound,common:{...bound.common,vendor:'ร้านใหม่',agreed:'3,210.00'}}).consideration).toBe('รับราคาจาก ร้านใหม่ วงเงิน 3,210.00 บาท');
 expect(d07Values({...bound,d07Overrides:{vendor:'ร้านเฉพาะฉบับ'}}).consideration).toContain('ร้านเฉพาะฉบับ');
});
it('preserves evidence bytes and validates references and file signatures',async()=>{
 const record=saveProcurement(sample()),bytes=Buffer.from('%PDF-1.7\nevidence');
 const id=await attachProcurementFile(record.id,record.version,bytes,'ใบเสนอราคา.pdf',{code:'OTHER',origin:'vendor',caseVersion:null});
 expect(readProcurementFile(id).bytes.equals(bytes)).toBe(true);
 await expect(attachProcurementFile(record.id,record.version,Buffer.from('fake'),'fake.pdf',{code:'D10',origin:'egp',caseVersion:null})).rejects.toThrow(/รองรับ/);
 await expect(attachProcurementFile(record.id,record.version,bytes,'../bad.pdf',{code:'D10',origin:'egp',caseVersion:null})).rejects.toThrow(/ชื่อไฟล์/);
 await expect(attachProcurementFile(record.id,record.version,bytes,'draft.pdf',{code:'D07',origin:'draft',caseVersion:record.version})).rejects.toThrow(/หลักฐาน/);
 expect(procurementSnapshot().files).toHaveLength(1);
});
it('keeps W322 separate from the method and warns at 5,000 exactly and for hiring under W804',()=>{
 const input={...sample('hire'),profile:'w804' as const,egpExemption:'w322' as const,common:{...sample().common,agreed:'5,000.00'}};
 expect(procurementWarnings(input).join(' ')).toContain('ตั้งแต่ 5,000');expect(procurementWarnings(input).join(' ')).toContain('งานซื้อไม่เกิน');
});
const reference=path.resolve('output/procurement-reference-17/templates/D07.docx');
describe.skipIf(!fs.existsSync(reference))('main database with the retained private D07 reference',()=>{
 it('exports an immutable case snapshot and never uses the lab latest session',async()=>{
  const source=fs.readFileSync(reference);installProcurementTemplate(source,'7.รายงานพิจารณาผล.docx');const record=saveProcurement(sample());
  const id=await generateProcurementD07(record.id,record.version),bytes=readProcurementFile(id).bytes;
  const changed=saveProcurement({...sample(),common:{...sample().common,vendor:'ร้านใหม่'}},record.id,record.version);
  expect(readProcurementFile(id).bytes.equals(bytes)).toBe(true);expect(procurementSnapshot().files[0].meta.caseVersion).toBe(record.version);
  await expect(generateProcurementD07(record.id,record.version)).rejects.toThrow(/เปลี่ยน/);
  const external=saveProcurement({...sample(),sources:{...sample().sources,D07:'external'}},record.id,changed.version);await expect(generateProcurementD07(external.id,external.version)).rejects.toThrow(/เลือกใช้/);
  expect(()=>installProcurementTemplate(Buffer.from('bad'),'bad.docx')).toThrow(/ไม่ตรง/);
 },20000);
 it('backs up and restores cases, revisions, private template and evidence bytes together',async()=>{
  fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');
  installProcurementTemplate(fs.readFileSync(reference),'D07.docx');const record=saveProcurement(sample());
  const id=await attachProcurementFile(record.id,record.version,Buffer.from('%PDF-1.7\noriginal'),'quote.pdf',{code:'OTHER',origin:'vendor',caseVersion:null});
  const originalHash=createHash('sha256').update(readProcurementFile(id).bytes).digest('hex');const backup=exportWorkspace();
  const changed=saveProcurement({...sample(),title:'แก้หลังสำรอง'},record.id,record.version);
  const preview=await prepareBackupRestore(path.basename(backup.folder));expect(preview.counts.procurement_cases).toBe(1);expect(preview.counts.procurement_templates).toBe(1);expect(preview.counts.procurement_files).toBe(1);
  activateBackupRestore(preview.token,'กู้คืนข้อมูล');expect(readProcurement(record.id).title).toBe('งานทดสอบระบบหลัก');expect(readProcurement(record.id).version).toBeGreaterThan(changed.version);
  expect(createHash('sha256').update(readProcurementFile(id).bytes).digest('hex')).toBe(originalHash);expect(procurementHistory(record.id)).toHaveLength(1);
 },20000);
});
