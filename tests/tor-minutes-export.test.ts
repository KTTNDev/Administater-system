import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import JSZip from 'jszip';import {PDFDocument} from 'pdf-lib';
import {db,setSetting,writeDraft,readDraft} from '../src/lib/db';
import {renderWord} from '../src/lib/word';import {renderPdf} from '../src/lib/pdf';
import {torMeetingFixture} from './fixtures/tor-minutes';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-tor-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,'test.sqlite');setSetting('storage:local',folder);fs.mkdirSync('output/tor-check',{recursive:true});});
afterAll(()=>db().close());
it('persists a TOR report and exports native editable Word tables and all content to PDF',async()=>{
 const d=torMeetingFixture(),saved=writeDraft(d),loaded=readDraft(saved.id);
 expect(loaded.minutesTor).toEqual(d.minutesTor);expect(loaded.meetingMembers).toEqual(d.meetingMembers);expect(loaded.meetingSigners).toEqual(d.meetingSigners);expect(loaded.meetingAgenda[3].speeches).toEqual(d.meetingAgenda[3].speeches);
 const word=await renderWord(loaded),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
 const text=[...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('').replaceAll('\u2060','');
 for(const marker of ['รายงานการประชุมคณะกรรมการ','ลายมือชื่อ','กรรมการตัวอย่าง 1','เลขานุการตัวอย่าง','ข้อซักถามตัวอย่าง','จบหัวข้อ TOR 8','ให้ทบทวนรายละเอียด'])expect(text).toContain(marker);
 expect(xml).toContain('<w:tbl>');expect(xml).not.toContain('w:altChunk');expect(xml).toContain('w:keepNext');
 const pdf=await renderPdf(loaded);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
 fs.writeFileSync('output/tor-check/tor-meeting-example.docx',word);fs.writeFileSync('output/tor-check/tor-meeting-example.pdf',pdf);
},60000);
