import { beforeAll,afterAll,it,expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { db,setSetting,writeDraft,readDraft } from '../src/lib/db';
import { createAttachment,readAttachment,validateAttachments,appendAttachments } from '../src/lib/attachments';
import { newDraft } from '../src/lib/document';
import { documentHtml } from '../src/lib/render-document';
import { exportWorkspace } from '../src/lib/storage';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-attachments-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(dir,'test.sqlite');setSetting('storage:local',path.join(dir,'files'));});afterAll(()=>db().close());
it('stores actual PDFs, preserves page order and sizes, persists draft references and backs up bytes',async()=>{
 const source=await PDFDocument.create();source.addPage([321,456]);source.addPage([456,321]);const a=await createAttachment(new File([new Uint8Array(await source.save())],'schedule.pdf'));
 const draft={...newDraft('internal'),attachmentFiles:[a]};validateAttachments(draft);expect(readAttachment(a.id).original).toEqual(Buffer.from(await source.save()));expect(readDraft(writeDraft(draft).id).attachmentFiles[0].id).toBe(a.id);
 const cover=await PDFDocument.create();cover.addPage([595,842]);const merged=await PDFDocument.load(await appendAttachments(Buffer.from(await cover.save()),draft));expect(merged.getPages().map(p=>p.getWidth())).toEqual([595,321,456]);
 const backup=exportWorkspace();expect(fs.readFileSync(path.join(backup.folder,a.id+'.pdf'))).toEqual(readAttachment(a.id).file);
 expect(()=>validateAttachments({...draft,attachmentFiles:[{...a,bytes:1}]})).toThrow();expect(()=>validateAttachments({...draft,attachmentFiles:[a,a]})).toThrow();
});
it('rejects fake files and encrypted or broken PDFs before storing',async()=>{
 await expect(createAttachment(new File(['<script>bad</script>'],'fake.pdf'))).rejects.toThrow();
 await expect(createAttachment(new File(['%PDF-broken'],'broken.pdf'))).rejects.toThrow();
});
it('only generates enclosure text for real selected references and uses the correct memo structure',()=>{
 const assets={regular:'',bold:'',garuda:''},empty={...newDraft(),attachments:'LEGACY_TEXT'};expect(documentHtml(empty,assets)).not.toContain('LEGACY_TEXT');expect(documentHtml(empty,assets)).not.toContain('สิ่งที่ส่งมาด้วย');
 const a={originalAvailable:false,id:'00000000-0000-4000-8000-000000000001',name:'a.pdf',description:'กำหนดการทดสอบ',pages:2,bytes:100,quantity:1,unit:'ฉบับ' as const};
 expect(documentHtml({...empty,attachmentFiles:[a]},assets)).toContain('สิ่งที่ส่งมาด้วย');const memo=documentHtml({...empty,type:'internal',attachmentFiles:[a]},assets);expect(memo).not.toContain('สิ่งที่ส่งมาด้วย');expect(memo).toContain('ตามเอกสารที่แนบมาพร้อมนี้');
});
