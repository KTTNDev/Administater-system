import {beforeEach,afterEach,it,expect,describe,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';import {DOMParser} from '@xmldom/xmldom';
import {db} from '../src/lib/db';
import {newProcurement,d01Values,d07Values,d01Missing,type ProcurementInput} from '../src/lib/procurement';
import {documentTemplates,commonFieldUsage} from '../src/lib/procurement-documents';
import {templateSlots} from '../src/lib/procurement-lab/template-model';
import {d01Initial,fillD01Template} from '../src/lib/procurement-d01-template';
import {blackReminderText} from '../src/lib/procurement-template';
import {installProcurementTemplate,procurementSnapshot,saveProcurement,generateProcurementDocument,readProcurementFile} from '../src/lib/procurement-db';
import {procurementPreset} from '../src/lib/procurement-presets';
import {buildLivePreview,requestLivePreview,livePreviewStatus,livePreviewPdf} from '../src/lib/procurement-live-preview';
import {nativeD07Pdf,finalizeProcurementWord} from '../src/lib/procurement-preview';
import {setStorage,exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
vi.mock('../src/lib/procurement-preview',()=>({nativeD07Pdf:vi.fn(),finalizeProcurementWord:vi.fn(async(word:Buffer)=>({word}))}));
const d01=path.resolve('output/procurement-d01/reference.docx'),d07=path.resolve('output/procurement-lab/template-d07/reference.docx');
const text=async(bytes:Buffer)=>{const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')!.async('string');return Array.from(new DOMParser().parseFromString(xml,'application/xml').getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')).map(t=>t.textContent).join('');};
const fillShared=(data:ProcurementInput)=>Object.assign(data.common,{department:'กองทดสอบ โทร. 000-000000',organization:'หน่วยงานทดสอบ',unit:'กองทดสอบ',category:'วัสดุสำนักงาน',recipient:'นายกหน่วยงานทดสอบ',proposer:'นายผู้เสนอ ทดสอบ',proposerPosition:'เจ้าพนักงานทดสอบ',directorRecipient:'ปลัดหน่วยงานทดสอบ',director:'นางผู้อำนวยการ ทดสอบ',directorPosition:'ผู้อำนวยการกองทดสอบ',secretaryRecipient:'นายกหน่วยงานทดสอบ',secretary:'นายปลัด ทดสอบ',secretaryPosition:'ปลัดหน่วยงานทดสอบ',authority:'นายผู้มีอำนาจ ทดสอบ',authorityPosition:'นายกหน่วยงานทดสอบ'});
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-live-preview-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'main.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');vi.mocked(nativeD07Pdf).mockReset();vi.mocked(finalizeProcurementWord).mockReset().mockImplementation(async word=>({word,bytes:Buffer.from('pdf'),pages:1,pageTexts:['ข้อความทดสอบ']}));delete (globalThis as {procurementLivePreview?:unknown}).procurementLivePreview;});
afterEach(()=>{db().close();(globalThis as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
describe.skipIf(!fs.existsSync(d01)||!fs.existsSync(d07))('source-based D01/D07 and unsaved live previews',()=>{
 const install=()=>{installProcurementTemplate(fs.readFileSync(d01),'D01.docx','D01');installProcurementTemplate(fs.readFileSync(d07),'D07.docx');};
 it('preserves D01 layout XML and every other part while changing only approved reminder colors',async()=>{
  const reference=fs.readFileSync(d01),values=await d01Initial(reference),built=await fillD01Template(values,reference),before=await JSZip.loadAsync(reference),after=await JSZip.loadAsync(built.bytes);
  expect(built.changed).toEqual([]);expect(await after.file('word/document.xml')!.async('string')).toBe(blackReminderText(await before.file('word/document.xml')!.async('string')));
  for(const [name,part] of Object.entries(before.files))if(name!=='word/document.xml'&&!part.dir)expect(await after.file(name)!.async('nodebuffer')).toEqual(await part.async('nodebuffer'));
 },20000);
 it('shows retained boilerplate up front while clearing old bill values and keeping document numbers separate',async()=>{
  install();const {data}=await procurementPreset('purchase');expect(data.common.vendor).toBe('');expect(data.common.offered).toBe('');expect(data.common.agreed).toBe('');expect(data.common.number).toBe('');expect(data.d01.number).toBe('');
  expect(data.common.organization).toBe('');expect(data.common.proposer).toBe('');expect(data.common.consideration).toContain('เกณฑ์');expect(data.d01.legalBasis).toContain('2560');expect(data.d01.background).toContain('{{budgetYear}}');expect(data.d01.facts).toContain('{{item}}');expect(d01Missing(data)).toContain('ปีงบประมาณ');
  data.d01Overrides.background='ปีงบประมาณ [ปีงบประมาณ]';expect(d01Missing(data)).toContain('ปีงบประมาณ');
  expect(procurementSnapshot().cases).toEqual([]);for(const slot of templateSlots)expect(commonFieldUsage[slot.key]).toBeTruthy();
 },20000);
 it('isolates edits to one document and fills every repeated name from its own values',async()=>{
  install();const {data}=await procurementPreset('purchase');data.common.proposer='นายชื่อกลาง ทดสอบ';data.common.number='ทดสอบ/07';data.d01.number='ทดสอบ/01';data.d07Overrides.proposer='นายเฉพาะ D07';data.d01Overrides.authority='นายเฉพาะ D01';
  expect(d01Values(data).proposer).toBe('นายชื่อกลาง ทดสอบ');expect(d07Values(data).proposer).toBe('นายเฉพาะ D07');expect(d07Values(data).authority).not.toBe('นายเฉพาะ D01');expect(d01Values(data).number).toBe('ทดสอบ/01');expect(d07Values(data).number).toBe('ทดสอบ/07');
  const preview=await buildLivePreview(data,'D01'),plain=await text(preview);expect(plain).toContain('นายชื่อกลาง ทดสอบ');expect(plain).not.toContain('นายเฉพาะ D07');expect(plain.match(/นายเฉพาะ D01/g)).toHaveLength(2);
 },20000);
 it('renders incomplete unsaved data as placeholders without fake prices or creating case/file revisions',async()=>{
  install();const {data}=await procurementPreset('purchase'),word=await buildLivePreview(data,'D07'),plain=await text(word);expect(plain).toContain('[รายชื่อผู้ยื่นข้อเสนอ]');expect(plain).toContain('—');expect(plain).not.toContain('1,520.00');expect(plain).not.toContain('ร้านดินสอสี');
  const snapshot=procurementSnapshot();expect(snapshot.cases).toEqual([]);expect(snapshot.files).toEqual([]);
 },20000);
 it('drops superseded pending input and serves the latest preview without saving the case',async()=>{
  install();const {data}=await procurementPreset('purchase'),client=randomUUID();let finishFirst!:(result:Awaited<ReturnType<typeof nativeD07Pdf>>)=>void;
  vi.mocked(finalizeProcurementWord).mockImplementationOnce(()=>new Promise(resolve=>{finishFirst=resolve as typeof finishFirst;})).mockResolvedValue({word:Buffer.from('word'),bytes:Buffer.from('latest-pdf'),pages:1,pageTexts:['ข้อความล่าสุด']});
  const first=await requestLivePreview(data,'D07',client);await vi.waitFor(()=>expect(finalizeProcurementWord).toHaveBeenCalledTimes(1));
  const second=await requestLivePreview({...data,common:{...data.common,vendor:'ร้านระหว่างพิมพ์'}},'D07',client),last=await requestLivePreview({...data,common:{...data.common,vendor:'ร้านล่าสุด'}},'D07',client);
  expect(livePreviewStatus(second.id).state).toBe('superseded');finishFirst({bytes:Buffer.from('first-pdf'),pages:1,pageTexts:['ข้อความแรก']});await vi.waitFor(()=>expect(livePreviewStatus(last.id).state).toBe('ready'));
  expect(finalizeProcurementWord).toHaveBeenCalledTimes(2);expect(livePreviewPdf(last.id).toString()).toBe('latest-pdf');expect(livePreviewStatus(first.id).state).toBe('ready');expect(procurementSnapshot().cases).toEqual([]);
 },20000);
 it('generates a saved D01 with its own number, date and linked budget values',async()=>{
  install();const {data}=await procurementPreset('purchase');data.title='ทดสอบ D01';fillShared(data);Object.assign(data.common,{item:'วัสดุทดสอบ 1 ชุด',budgetYear:'2569',allocatedBudget:'30,000.00',allocatedBudgetWords:'สามหมื่นบาทถ้วน'});Object.assign(data.d01,{number:'ทส/01',day:'15',month:'พฤศจิกายน',year:'2569'});
  const record=saveProcurement(data),id=await generateProcurementDocument(record.id,record.version,'D01'),bytes=readProcurementFile(id).bytes,plain=await text(bytes);expect(plain).toContain('ทส/01');expect(plain).toContain('วัสดุทดสอบ 1 ชุด');expect(plain).toContain('30,000.00');expect(plain).not.toContain('{{');expect(procurementSnapshot().files[0].meta.templateHash).toBe(documentTemplates.D01.sha256);
  const zip=await JSZip.loadAsync(bytes),footer=await zip.file('word/footer1.xml')!.async('string');expect(footer).toContain('ใบต่อบันทึกข้อความ เรื่อง');expect(footer).toContain('ทส/01');expect(footer).toContain('15 พฤศจิกายน 2569');expect(footer).not.toContain('ครุภัณฑ์คอมพิวเตอร์');
 },20000);
 it('uses identical DOCX bytes for a complete live preview and its exported Word, and restores both templates and files',async()=>{
  install();const {data}=await procurementPreset('purchase');data.title='ชุดทดสอบ preview ตรง Word';fillShared(data);Object.assign(data.common,{item:'วัสดุสำนักงาน 1 ชุด',vendor:'ร้านทดสอบ',offered:'1,366.00',agreed:'1,366.00',number:'ทส/07',budgetYear:'2569',allocatedBudget:'30,000.00',allocatedBudgetWords:'สามหมื่นบาทถ้วน'});data.d01.number='ทส/01';
  const record=saveProcurement(data),outputs=[];
  for(const code of ['D01','D07'] as const){const id=await generateProcurementDocument(record.id,record.version,code),bytes=readProcurementFile(id).bytes;expect(await buildLivePreview(data,code)).toEqual(bytes);outputs.push({id,bytes});}
  fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');const backup=exportWorkspace();saveProcurement({...data,title:'แก้หลังสำรอง'},record.id,record.version);
  const preview=await prepareBackupRestore(path.basename(backup.folder));expect(preview.counts.procurement_templates).toBe(2);expect(preview.counts.procurement_files).toBe(2);activateBackupRestore(preview.token,'กู้คืนข้อมูล');for(const output of outputs)expect(readProcurementFile(output.id).bytes).toEqual(output.bytes);
 },20000);
});
