import { beforeAll,afterAll,it,expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { db,setSetting,writeDraft,readDraft } from '../src/lib/db';
import { createAttachment,readAttachment,validateAttachments,appendAttachments } from '../src/lib/attachments';
import { documentSchema,newDraft } from '../src/lib/document';
import { documentHtml } from '../src/lib/render-document';
import { exportWorkspace } from '../src/lib/storage';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-attachments-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(dir,'test.sqlite');setSetting('storage:local',path.join(dir,'files'));});afterAll(()=>db().close());
it('stores actual PDFs, preserves page order and sizes, persists draft references and backs up bytes',async()=>{
 const source=await PDFDocument.create();source.addPage([321,456]);source.addPage([456,321]);const a=await createAttachment(new File([new Uint8Array(await source.save())],'schedule.pdf'));
 const draft={...newDraft('internal'),attachmentFiles:[{...a,showNameInDocument:false}]};validateAttachments(draft);expect(readAttachment(a.id).original).toEqual(Buffer.from(await source.save()));const saved=readDraft(writeDraft(draft).id).attachmentFiles[0];expect(saved.id).toBe(a.id);expect(saved.showNameInDocument).toBe(false);
 const cover=await PDFDocument.create();cover.addPage([595,842]);const merged=await PDFDocument.load(await appendAttachments(Buffer.from(await cover.save()),draft));expect(merged.getPages().map(p=>p.getWidth())).toEqual([595,321,456]);
 const backup=exportWorkspace();expect(fs.readFileSync(path.join(backup.folder,a.id+'.pdf'))).toEqual(readAttachment(a.id).file);
 expect(()=>validateAttachments({...draft,attachmentFiles:[{...a,bytes:1}]})).toThrow();expect(()=>validateAttachments({...draft,attachmentFiles:[a,a]})).toThrow();
});
it('rejects fake files and encrypted or broken PDFs before storing',async()=>{
 await expect(createAttachment(new File(['<script>bad</script>'],'fake.pdf'))).rejects.toThrow();
 await expect(createAttachment(new File(['%PDF-broken'],'broken.pdf'))).rejects.toThrow();
});
it('only generates enclosure text for real selected references and uses the correct memo structure',()=>{
 const assets={regular:'',bold:'',garuda:'',routingStamp:'',copyMark:''},empty={...newDraft(),attachments:'LEGACY_TEXT'};expect(documentHtml(empty,assets)).not.toContain('LEGACY_TEXT');expect(documentHtml(empty,assets)).not.toContain('สิ่งที่ส่งมาด้วย');
 const a={originalAvailable:false,id:'00000000-0000-4000-8000-000000000001',name:'a.pdf',description:'กำหนดการทดสอบ',showNameInDocument:true,pages:2,bytes:100,quantity:1,unit:'ฉบับ' as const};
 expect(documentHtml({...empty,attachmentFiles:[a]},assets)).toContain('สิ่งที่ส่งมาด้วย');const memo=documentHtml({...empty,type:'internal',attachmentFiles:[a]},assets);expect(memo).not.toContain('สิ่งที่ส่งมาด้วย');expect(memo).toContain('ตามเอกสารที่แนบมาพร้อมนี้');
});

it('keeps the attachment and its count while hiding its name in external and internal documents',()=>{
 const assets={regular:'',bold:'',garuda:'',routingStamp:'',copyMark:''};
 const file={originalAvailable:false,id:'00000000-0000-4000-8000-000000000019',name:'private-schedule.pdf',description:'กำหนดการภายใน',pages:2,bytes:100,quantity:2,unit:'ฉบับ' as const};
 expect(documentSchema.parse({...newDraft(),attachmentFiles:[file]}).attachmentFiles[0].showNameInDocument).toBe(true);
 const hidden={...file,showNameInDocument:false};
 for(const type of ['external','internal'] as const){
  const html=documentHtml({...newDraft(type),attachmentFiles:[hidden]},assets);
  expect(html).toContain('เอกสารแนบ จำนวน 2 ฉบับ');
  expect(html).not.toContain(file.description);
  expect(html).not.toContain(file.name);
 }
});

it('lists authored pages, picture sheets, uploaded files, and separately delivered items on an external letter',()=>{
 const assets={regular:'',bold:'',garuda:'',routingStamp:'',copyMark:''};
 const image=(id:string)=>({id,name:'photo.png',mime:'image/png' as const,bytes:100,width:900,height:1600,caption:'',widthMm:80});
 const html=documentHtml({...newDraft('external'),body:'เนื้อหาหนังสือ',
   appendixPages:[{id:'00000000-0000-4000-8000-000000000010',title:'รายละเอียดโครงการ',body:'ข้อมูล'}],
   appendixTitle:'ภาพประกอบการตรวจสอบ',
   appendixImages:[image('00000000-0000-4000-8000-000000000011'),image('00000000-0000-4000-8000-000000000012'),image('00000000-0000-4000-8000-000000000013')],
   attachmentFiles:[{originalAvailable:false,id:'00000000-0000-4000-8000-000000000014',name:'schedule.pdf',description:'กำหนดการ',showNameInDocument:true,pages:2,bytes:100,quantity:2,unit:'ฉบับ'}],
   additionalEnclosures:'วัสดุประกอบ จำนวน 1 ชุด (ส่งทางพัสดุไปรษณีย์)',
 },assets);
 const rows=Array.from(html.matchAll(/<p class="enclosure-row[^"]*">([^]*?)<\/p>/g),match=>match[1]);
 expect(rows).toHaveLength(4);
 expect(rows[0]).toContain('สิ่งที่ส่งมาด้วย');
 expect(rows[0]).toContain('รายละเอียดโครงการ จำนวน 1 ฉบับ');
 expect(rows[1]).toContain('ภาพประกอบการตรวจสอบ จำนวน 2 แผ่น');
 expect(rows[2]).toContain('กำหนดการ จำนวน 2 ฉบับ');
 expect(rows[3]).toContain('วัสดุประกอบ จำนวน 1 ชุด (ส่งทางพัสดุไปรษณีย์)');
 expect(html.indexOf('สิ่งที่ส่งมาด้วย')).toBeLessThan(html.indexOf('เนื้อหา'));
});
