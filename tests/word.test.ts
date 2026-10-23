import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {templates} from '../src/lib/templates';
import {newDraft,type Draft} from '../src/lib/document';
import {budgetSample} from '../src/lib/budget';
import {budgetDraft} from '../src/lib/budget-document';
import {db,setSetting} from '../src/lib/db';
import {createAttachment} from '../src/lib/attachments';
import {createAppendixImage} from '../src/lib/appendix';
import {renderWord} from '../src/lib/word';
import {renderPdf} from '../src/lib/pdf';
import {MissingOverlayPageError} from '../src/lib/export-validation';
// Text may span styled runs and explicit no-break groups; assert logical paragraphs, not ZIP serialization boundaries.
const paragraphTexts=(xml:string)=>Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g),p=>Array.from(p[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060',''));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-word-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,'data.sqlite');setSetting('storage:local',folder);fs.mkdirSync('output/word-check',{recursive:true});});
afterAll(()=>db().close());
const base={subject:'การตรวจสอบอุปกรณ์สำนักงาน',organization:'เทศบาลตัวอย่าง',department:'สำนักปลัดเทศบาล',address:'อำเภอเมือง จังหวัดตัวอย่าง 10000',phone:'0 2000 0000',number:'ทส 0000/123',recipient:'ผู้อำนวยการกองคลัง',signer:'นายทดสอบ งานราชการ',position:'นายกเทศมนตรี',body:'ด้วยเทศบาลมีความประสงค์ตรวจสอบ **อุปกรณ์สำนักงาน** เพื่อจัดทำข้อมูลประกอบการพิจารณา\n| ลำดับ | รายการ | จำนวน |\n| --- | --- | --- |\n| 1 | โต๊ะทำงาน | 2 |\n| 2 | เก้าอี้ | 3 |\nจึงเรียนมาเพื่อโปรดพิจารณา',meetingNo:'1/2569',location:'ห้องประชุมเทศบาล',attendees:'นายทดสอบ งานราชการ',startTime:'09.00 น.',endTime:'10.00 น.',recorder:'นางสาวตัวอย่าง ผู้บันทึก'};
async function inspect(name:string,draft:Draft){
 const bytes=await renderWord(draft);fs.writeFileSync(`output/word-check/${name}.docx`,bytes);
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')!.async('string');
 expect(xml).not.toContain('w:altChunk');expect(xml).toContain('w:t');
 expect(await zip.file('word/fontTable.xml')!.async('string')).toContain('w:embedRegular');
 expect(xml).toContain('w:szCs');expect(xml).not.toContain('\u200b');expect(xml).not.toMatch(/<w:(?:br|cr)[\s/>]/);expect(xml).toContain('<w:noProof/>');expect(xml).toContain('w:val="th-TH"');return {zip,xml};
}
for(const t of templates)it(`exports editable ${t.id} text, bold runs and native tables`,async()=>{
 const {xml}=await inspect(t.id,{...newDraft(t.id),...base});
 expect(paragraphTexts(xml).join('')).toContain('อุปกรณ์สำนักงาน');expect(xml).toContain('<w:tbl>');expect(xml).toContain('<w:b/>');
 expect(xml).toContain('w:tblHeader');expect(paragraphTexts(xml).join('')).toContain('จึงเรียนมาเพื่อโปรดพิจารณา');
},30000);
it('exports budget memo including all budget lines and opinions',async()=>{
 const {xml}=await inspect('budget',budgetDraft(budgetSample('2026-10-12')));
 expect(xml).toContain('IP Phone');expect(xml).toContain('โอนลด');expect(xml).toContain('๑๕๒,๔๖๐');
},30000);
it('keeps original/copy bundles, authored appendices, PDF pages, image pairs and floating text',async()=>{
 const pdf=await PDFDocument.create();const pdfPage=pdf.addPage([595,842]);pdfPage.drawText('Uploaded attachment',{x:40,y:750,font:await pdf.embedFont(StandardFonts.Helvetica)});
 const file=await createAttachment(new File([new Uint8Array(await pdf.save())],'appendix.pdf'));
 const picture=await createAppendixImage(new File([new Uint8Array(fs.readFileSync('public/assets/garuda.png'))],'photo.png',{type:'image/png'}));
 const {xml,zip}=await inspect('bundle',{...newDraft('external'),...base,copyMark:'สำเนาคู่ฉบับ',productionMark:true,
  appendixPages:[{id:crypto.randomUUID(),title:'บัญชีประกอบเพิ่มเติม',body:'**ข้อความแก้ไขได้**\n| หัวข้อ | รายละเอียด |\n| --- | --- |\n| ตัวอย่าง | ตรวจสอบได้ |'}],appendixImages:[{...picture,caption:'ภาพประกอบแก้คำบรรยายได้',widthMm:120}],attachmentFiles:[file],
  floatingItems:[{kind:'text',id:crypto.randomUUID(),page:1,xMm:20,yMm:270,widthMm:100,fontPt:16,bold:true,text:'กล่องข้อความทดสอบ'}]});
 expect(xml.match(/บัญชีประกอบเพิ่มเติม/g)?.length).toBe(4); // enclosure + authored heading in both copies
 expect(xml.match(/กล่องข้อความทดสอบ/g)?.length).toBe(2);
 expect(xml.match(/<w:sectPr>/g)?.length).toBe(8);
 expect(xml).toContain('ข้อความแก้ไขได้');expect(xml).toContain('wps:txbx');expect(xml).toContain('wp:anchor');
 expect(Object.keys(zip.files).filter(n=>n.startsWith('word/media/')).length).toBeGreaterThanOrEqual(5);
},45000);
it('preserves long native tables and underlined structured sections without losing rows',async()=>{
 const rows=Array.from({length:70},(_,i)=>`| R${i+1} | รายการอุปกรณ์ที่ต้องตรวจสอบ |`).join('\n');
 const {xml}=await inspect('long-internal',{...newDraft('internal'),...base,bodyMode:'structured',background:'เรื่องเดิมสำหรับตรวจสอบ',facts:'| รหัส | รายละเอียด |\n| --- | --- |\n'+rows,legalBasis:'ระเบียบที่เกี่ยวข้อง',consideration:'เห็นควรดำเนินการ',proposal:'จึงเรียนมาเพื่อโปรดพิจารณา',opinions:[{title:'ความเห็นหัวหน้าสำนักปลัด',comment:'เห็นควรดำเนินการตามเสนอ',name:'ผู้ตรวจทาน',position:'หัวหน้าสำนักปลัด',showDate:true,lines:1}]});
 expect(xml.match(/<w:tbl>/g)!.length).toBeGreaterThan(1);
 for(let n=1;n<=70;n++)expect(xml).toContain(`>R${n}</w:t>`);
 expect(xml).toContain('w:u');expect(paragraphTexts(xml).join('')).toContain('หัวหน้าสำนักปลัด');
},30000);

it('keeps a long Thai paragraph intact and uses real paragraphs for explicit newlines',async()=>{
 const text='เทศบาลมีความประสงค์ตรวจสอบอุปกรณ์สำนักงานเพื่อจัดทำข้อมูลประกอบการพิจารณาดำเนินการตามระเบียบที่เกี่ยวข้อง '.repeat(50).trim();
 const {xml,zip}=await inspect('thai-paragraphs',{...newDraft('internal'),...base,body:text+'\nย่อหน้าใหม่สำหรับข้อเสนอ',position:'นายกเทศมนตรี\nรักษาราชการแทน',floatingItems:[{kind:'text',id:crypto.randomUUID(),page:1,xMm:20,yMm:270,widthMm:100,fontPt:16,bold:false,text:'บรรทัดแรก\nบรรทัดถัดไป'}]});
 expect(paragraphTexts(xml)).toContain(text);
 expect(xml).toContain('<w:jc w:val="thaiDistribute"/>');
 expect(xml).toContain('ย่อหน้าใหม่สำหรับข้อเสนอ');
 expect(xml.replaceAll('\u2060','')).toMatch(/นายกเทศมนตรี<\/w:t>[\s\S]*?<\/w:p><w:p>[\s\S]*?รักษาราชการแทน/);
 expect(await zip.file('word/styles.xml')!.async('string')).toContain('<w:noProof/>');
},30000);

it('exports a transparent signature as a positioned image in both counterparts',async()=>{
 const bytes=fs.readFileSync('tests/fixtures/signature-synthetic.png');
 const {source,caption,widthMm,...image}=await createAppendixImage(new File([bytes],'signature-synthetic.png',{type:'image/png'}));
 const {xml,zip}=await inspect('signature-image',{...newDraft('external'),...base,copyMark:'สำเนาคู่ฉบับ',floatingItems:[{kind:'image',purpose:'signature',id:crypto.randomUUID(),page:1,xMm:120,yMm:200,widthMm:45,image}]});
 expect(xml.match(/name="signature-synthetic.png"/g)?.length).toBe(2);
 expect(xml).toContain('behindDoc="0"');expect(xml).not.toContain('ลากเพื่อปรับขนาดภาพ');
 const media=await Promise.all(Object.entries(zip.files).filter(([name])=>name.startsWith('word/media/')&&!name.endsWith('/')).map(([,file])=>file.async('nodebuffer')));
 expect(media.some(buffer=>buffer.equals(bytes))).toBe(true);
},30000);

for(const copyMark of ['none', 'สำเนาคู่ฉบับ'] as const)it(`refuses to lose an overlay on a nonexistent original page (${copyMark||'original'})`,async()=>{
 const draft:Draft={...newDraft('internal'),...base,body:'จึงเรียนมาเพื่อโปรดพิจารณา',copyMark,floatingItems:[{kind:'text',id:'missing-page',page:2,xMm:30,yMm:50,widthMm:75,fontPt:16,bold:false,text:'ข้อความต้องไม่หาย'}]};
 await expect(renderWord(draft)).rejects.toBeInstanceOf(MissingOverlayPageError);
 await expect(renderPdf(draft)).rejects.toBeInstanceOf(MissingOverlayPageError);
},30000);

it('centers formal titles on the same page axis as the garuda in Word',async()=>{
 for(const type of ['order','announcement','statement','regulation','rule','internal','memorandum'] as const){
  const {xml}=await inspect('center-'+type,{...newDraft(type),...base});
  const paragraphs=Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)).map(m=>m[1]);
  const title=paragraphs.find(p=>p.includes('w:val="center"')&&p.includes(['internal','memorandum'].includes(type)?'บันทึกข้อความ':'การตรวจสอบ'))!;
  expect(title).toBeTruthy();
  const pageWidth=Number(xml.match(/<w:pgSz[^>]*w:w="(\d+)"/)![1]),margin=xml.match(/<w:pgMar[^>]*w:right="(\d+)"[^>]*w:left="(\d+)"/)!;
  const indent=title.match(/<w:ind w:left="(\d+)" w:right="(\d+)"/)!;
  const center=(Number(margin[2])+Number(indent[1])+pageWidth-Number(margin[1])-Number(indent[2]))/2;
  expect(Math.abs(center-pageWidth/2)).toBeLessThan(2);
  if(['internal','memorandum'].includes(type))continue; // Memo garuda intentionally stays at the left margin.
  const anchor=xml.match(/<wp:positionH[^>]*><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionH>[\s\S]*?<wp:extent cx="(\d+)"/)!;
  expect(Math.abs((Number(anchor[1])+Number(anchor[2])/2)/635-center)).toBeLessThan(2);
 }
},30000);

it('exports matching editable field and signature guides without duplicating header content',async()=>{
 const draft={...newDraft('internal'),...base,subject:'DOT-GUIDE-CHECK',opinions:[{title:'ความเห็น',name:'',position:'เจ้าหน้าที่',comment:'',lines:2,showDate:true}]};
 const {xml}=await inspect('dot-guides',draft);
 const anchors=Array.from(xml.matchAll(/<wp:anchor[\s\S]*?<\/wp:anchor>/g),m=>m[0]);
 const guides=anchors.filter(a=>/<w:t[^>]*>\.+<\/w:t>/.test(a));
 expect(guides).toHaveLength(6);
 for(const guide of guides){expect(guide).toContain('w:val="32"');expect(guide).toContain('w:val="111111"');expect(guide).toContain('TH Sarabun New');expect(guide).toContain('wps:txbx');}
 expect(paragraphTexts(xml).filter(t=>t.includes('DOT-GUIDE-CHECK'))).toHaveLength(1);
 expect(paragraphTexts(xml).find(t=>t.includes('DOT-GUIDE-CHECK'))).not.toContain('...');
},30000);
