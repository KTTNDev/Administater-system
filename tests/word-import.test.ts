import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import {analyzeWord} from '../src/lib/word-import';
import {importWordDraft,listDocumentSources,readDocumentSource,duplicateDraftWithSources} from '../src/lib/document-sources';
import {db,setSetting,listDrafts,writeDraft,removeDraft,restoreDraft,readDraft} from '../src/lib/db';
import {newDraft} from '../src/lib/document';
import {renderWord} from '../src/lib/word';
import {exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
import {buildDossierSyncPlan} from '../scripts/dossier-sync-plan.mjs';
import {copyWorkspaceFiles} from '../scripts/workspace-files.mjs';
const w='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p=(text:string)=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
async function file(body:string,extra:Record<string,string>={}){const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml',`<w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`);for(const [key,value]of Object.entries(extra))zip.file(key,value);return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
const header=p('บันทึกข้อความ')+p('ส่วนราชการ กองสวัสดิการสังคม')+p('ที่ ทส ๑๒/๒๕๗๐\tวันที่ ๖ พฤศจิกายน ๒๕๖๙')+p('เรื่อง ขออนุมัติโครงการ')+p('เรียน นายกเทศมนตรี');
const body=header+p('ข้อเท็จจริง')+'<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ผู้สูงอายุ</w:t></w:r><w:r><w:br/><w:t>เข้าร่วมโครงการ</w:t></w:r></w:p>'+p('จึงเรียนมาเพื่อโปรดพิจารณา')+p('(นายสมชาย ตัวอย่าง)')+p('ผู้อำนวยการกองสวัสดิการสังคม');
const table='<w:tbl><w:tr><w:tc>'+p('รายการ')+'</w:tc><w:tc>'+p('จำนวน')+'</w:tc></w:tr><w:tr><w:tc>'+p('กระดาษ')+'</w:tc><w:tc>'+p('๒')+'</w:tc></w:tr></w:tbl>';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-word-import-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'test.sqlite'));vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');setSetting('storage:local',path.join(folder,'files'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
it('extracts Thai header/date, styled paragraphs, soft breaks, heading and signature without creating a draft',async()=>{
 const analysis=await analyzeWord(await file(body),'memo.docx');expect(analysis.fields).toMatchObject({organization:'กองสวัสดิการสังคม',number:'ทส ๑๒/๒๕๗๐',date:'2026-11-06',subject:'ขออนุมัติโครงการ',recipient:'นายกเทศมนตรี',signer:'นายสมชาย ตัวอย่าง',position:'ผู้อำนวยการกองสวัสดิการสังคม'});expect(analysis.fields.body).toContain('## ข้อเท็จจริง');expect(analysis.fields.body).toContain('**ผู้สูงอายุ**\u2028เข้าร่วมโครงการ');expect(analysis.sourceText).toContain('ส่วนราชการ');expect(listDrafts()).toHaveLength(0);
});
it('preserves tables, unknown text and all header/footer text; warns about unsupported image and merged cells',async()=>{
 const analysis=await analyzeWord(await file(header+table+p('ข้อความเพิ่มเติม')+'<w:p><w:r><w:drawing/></w:r></w:p><w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'+p('เซลล์ผสาน')+'</w:tc></w:tr></w:tbl>',{'word/footer1.xml':`<w:ftr xmlns:w="${w}">${p('เชิงอรรถที่ต้องตรวจ')}</w:ftr>`}),'table.docx');
 expect(analysis.tables).toBe(2);expect(analysis.fields.body).toContain('| รายการ | จำนวน |\n| --- | --- |\n| กระดาษ | ๒ |');expect(analysis.fields.body).toContain('ข้อความเพิ่มเติม');expect(analysis.sourceText).toContain('เชิงอรรถที่ต้องตรวจ');expect(analysis.warnings.join(' ')).toMatch(/เซลล์ผสาน/);expect(analysis.warnings.join(' ')).toMatch(/ภาพหรือวัตถุ/);
});
it('leaves missing fields empty and rejects invalid dates rather than guessing',async()=>{
 const analysis=await analyzeWord(await file(p('เรื่อง ไม่มีข้อมูลครบ')+p('วันที่ ๓๑ กุมภาพันธ์ ๒๕๖๙')+p('เรียน ผู้อำนวยการ')+p('ข้อความ')),'missing.docx');expect(analysis.fields.date).toBe('');expect(analysis.fields.organization).toBe('');expect(analysis.fields.signer).toBe('');expect(analysis.warnings.join(' ')).toContain('วันที่');
});
it('rejects non-DOCX, corrupt, macro, DTD/entity, deeply nested and inflated XML',async()=>{
 await expect(analyzeWord(Buffer.from('bad'),'old.doc')).rejects.toThrow(/docx/);await expect(analyzeWord(Buffer.from('bad'),'fake.docx')).rejects.toThrow(/เปิดไฟล์/);
 await expect(analyzeWord(await file(body,{'word/vbaProject.bin':'macro'}),'macro.docx')).rejects.toThrow(/แมโคร/);
 await expect(analyzeWord(await file('<!DOCTYPE x [<!ENTITY y "bad">]>'+p('text')),'entity.docx')).rejects.toThrow(/XML/);
 await expect(analyzeWord(await file('<w:sdt>'.repeat(81)+p('deep')+'</w:sdt>'.repeat(81)),'deep.docx')).rejects.toThrow(/ซับซ้อน/);
 await expect(analyzeWord(await file(p('x'.repeat(6*1024*1024))),'huge.docx')).rejects.toThrow(/ใหญ่เกิน/);
});
it('keeps the imported file atomically and makes retry idempotent while ignoring untrusted status/attachments',async()=>{
 const bytes=await file(body),source=new File([new Uint8Array(bytes)],'ต้นฉบับ.docx'),analysis=await analyzeWord(bytes,source.name),requestId=randomUUID();
 const saved=await importWordDraft(source,{...analysis.fields,status:'reviewed',attachmentFiles:[{id:'bad'}]},requestId);const retry=await importWordDraft(source,analysis.fields,requestId);expect(retry.id).toBe(saved.id);expect(listDrafts()).toHaveLength(1);expect(saved.status).toBe('draft');expect(saved.numeralStyle).toBe('thai');expect(saved.attachmentFiles).toEqual([]);expect(saved.localFileWarning).toBe('');expect(readDocumentSource(requestId).file.equals(bytes)).toBe(true);
 await expect(importWordDraft(source,{...analysis.fields,subject:'เปลี่ยน'},requestId)).rejects.toThrow(/คำขอ/);
 const rows=listDocumentSources(saved.id);expect(rows[0].analysis.sourceText).toBe(analysis.sourceText);expect(db().prepare('SELECT count(*) n FROM document_numbers').get()!.n).toBe(0);
});
it('prevents duplicate numbers, invalid review input and partial creation when original insert fails',async()=>{
 const source=new File([new Uint8Array(await file(body))],'memo.docx'),a=await analyzeWord(Buffer.from(await source.arrayBuffer()),source.name);
 await expect(importWordDraft(source,{...a.fields,subject:''},randomUUID())).rejects.toThrow(/เรื่อง/);expect(listDrafts()).toHaveLength(0);
 db().exec("CREATE TRIGGER fail_source BEFORE INSERT ON document_sources BEGIN SELECT RAISE(ABORT,'test insert failure'); END");await expect(importWordDraft(source,a.fields,randomUUID())).rejects.toThrow(/failure/);expect(listDrafts()).toHaveLength(0);db().exec('DROP TRIGGER fail_source');
 await importWordDraft(source,a.fields,randomUUID());await expect(importWordDraft(source,a.fields,randomUUID())).rejects.toThrow(/เลขที่หนังสือซ้ำ/);expect(db().prepare('SELECT count(*) n FROM document_sources').get()!.n).toBe(1);
});
it('source follows rename, duplication, trash/restore and Drive plan, and is copied to a new machine unchanged',async()=>{
 const bytes=await file(body),a=await analyzeWord(bytes,'memo.docx'),id=randomUUID(),saved=await importWordDraft(new File([new Uint8Array(bytes)],'memo.docx'),a.fields,id),storage=path.join(folder,'files');
 let plan=buildDossierSyncPlan(db(),storage),entry=plan.entries.find(e=>e.mime.includes('wordprocessingml'))!;expect(entry.relativePath).toContain('ต้นฉบับนำเข้า');expect(entry.relativePath).toContain('ปีงบประมาณ 2570');expect(fs.readFileSync(path.join(storage,entry.relativePath)).equals(bytes)).toBe(true);
 const edited=writeDraft({...saved,subject:'เปลี่ยนชื่อเรื่อง'},saved.id,saved.version);plan=buildDossierSyncPlan(db(),storage);expect(plan.entries.find(e=>e.key===entry.key)!.relativePath).toContain('เปลี่ยนชื่อเรื่อง');
 const duplicate=duplicateDraftWithSources(saved.id);expect(listDocumentSources(duplicate.id)).toHaveLength(1);expect(duplicate.number).toBe('');
 removeDraft(saved.id,edited.version);expect(()=>readDocumentSource(id)).toThrow();expect(buildDossierSyncPlan(db(),storage).entries.some(e=>e.ownerId===saved.id)).toBe(false);restoreDraft(saved.id,edited.version+1);expect(readDocumentSource(id).file.equals(bytes)).toBe(true);
 const target=path.join(folder,'other-machine');copyWorkspaceFiles(storage,target,path.join(folder,'test.sqlite'));entry=buildDossierSyncPlan(db(),target).entries.find(e=>e.ownerId===saved.id&&e.mime.includes('wordprocessingml'))!;expect(fs.readFileSync(path.join(target,entry.relativePath)).equals(bytes)).toBe(true);
});
it('backs up and restores original Word, extracted source and edited draft together',async()=>{
 const bytes=await file(body),a=await analyzeWord(bytes,'memo.docx'),id=randomUUID(),saved=await importWordDraft(new File([new Uint8Array(bytes)],'memo.docx'),a.fields,id);
 const backup=exportWorkspace();expect(backup.counts.document_sources).toBe(1);expect(fs.readFileSync(path.join(backup.folder,id+'-import-original.docx')).equals(bytes)).toBe(true);
 db().prepare('DELETE FROM document_sources').run();writeDraft({...saved,body:'edited'},saved.id,saved.version);
 const preview=await prepareBackupRestore(path.basename(backup.folder));expect(preview.counts.document_sources).toBe(1);activateBackupRestore(preview.token,'กู้คืนข้อมูล');expect(readDocumentSource(id).file.equals(bytes)).toBe(true);expect(readDraft(saved.id).body).toBe(a.fields.body);
});
it('reports disk errors after a committed import and retry returns the same draft',async()=>{
 const bytes=await file(body),a=await analyzeWord(bytes,'memo.docx'),source=new File([new Uint8Array(bytes)],'memo.docx'),id=randomUUID();const bad=path.join(folder,'blocked');fs.writeFileSync(bad,'leave unchanged');setSetting('storage:local',bad);
 const saved=await importWordDraft(source,a.fields,id);expect(saved.localFileWarning).toMatch(/ฐานข้อมูลแล้ว/);expect(readDocumentSource(id).file.equals(bytes)).toBe(true);setSetting('storage:local',path.join(folder,'files'));const retry=await importWordDraft(source,a.fields,id);expect(retry.id).toBe(saved.id);expect(retry.localFileWarning).toBe('');expect(fs.readFileSync(bad,'utf8')).toBe('leave unchanged');
});
it('detects confidentiality and excludes original from Drive until explicitly reclassified',async()=>{
 const bytes=await file(p('ลับมาก')+body),a=await analyzeWord(bytes,'memo.docx');expect(a.fields.confidentiality).toBe('ลับมาก');const saved=await importWordDraft(new File([new Uint8Array(bytes)],'memo.docx'),a.fields,randomUUID());expect(buildDossierSyncPlan(db(),path.join(folder,'files')).entries.some(e=>e.ownerId===saved.id)).toBe(false);
});
it('can read a genuine editable Word exported by this system without requiring Word installed',async()=>{
 const original={...newDraft('internal'),subject:'ทดสอบนำกลับจาก Word',organization:'กองสวัสดิการสังคม',date:'2026-11-06',recipient:'นายกเทศมนตรี',body:'ด้วยกองสวัสดิการสังคมมีความประสงค์จัดโครงการ\nจึงเรียนมาเพื่อโปรดพิจารณา',signer:'นายสมชาย ตัวอย่าง',position:'ผู้อำนวยการกองสวัสดิการสังคม'};
 const bytes=await renderWord(original),analysis=await analyzeWord(bytes,'roundtrip.docx');fs.mkdirSync('output/word-import-check',{recursive:true});fs.writeFileSync('output/word-import-check/roundtrip.json',JSON.stringify(analysis,null,2));expect(analysis.fields.subject).toBe(original.subject);expect(analysis.fields.recipient).toBe(original.recipient);expect(analysis.fields.body).toContain('ด้วยกองสวัสดิการสังคม');expect(analysis.fields.date).toBe(original.date);expect(analysis.fields.signer).toBe(original.signer);
},30000);

it('preserves ambiguous opinion signers for review instead of choosing the last person as the main signer',async()=>{
 const a=await analyzeWord(await file(body+p('ความเห็นนายกเทศมนตรี')+p('อนุมัติ')+p('(นายผู้อนุมัติ ตัวอย่าง)')+p('นายกเทศมนตรี')),'opinions.docx');expect(a.fields.signer).toBe('');expect(a.fields.body).toContain('นายสมชาย ตัวอย่าง');expect(a.fields.body).toContain('นายผู้อนุมัติ ตัวอย่าง');expect(a.warnings.join(' ')).toContain('ความเห็นท้ายหนังสือ');
});
