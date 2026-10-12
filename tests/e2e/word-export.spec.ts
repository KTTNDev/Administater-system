import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {templates} from '../../src/lib/templates';

for(const template of templates)test(`Word download saves current ${template.id} draft and returns editable DOCX`,async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated data');
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:template.name,exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
 const number=page.getByLabel(/^(เลขที่หนังสือ|ฉบับที่ \(ถ้ามี\))$/);if(await number.count())await number.fill('');
 const subject=`ส่งต่อแก้ไข Word ${template.id} ${Date.now()}`;
 await page.getByLabel(['stamped','certificate'].includes(template.id)?'ชื่อร่างในรายการเอกสาร':template.id==='minutes'?'ชื่อการประชุม':'เรื่อง / ชื่อร่าง').fill(subject);
 if(template.id==='internal'){
  const pdf=await PDFDocument.create();pdf.addPage([500,400]).drawText('Attached page',{x:40,y:300});
  await page.getByLabel('เพิ่ม PDF หรือรูปภาพ').setInputFiles({name:'ตัวอย่าง.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await expect(page.locator('.attachment-card')).toContainText('1 หน้า');
 }
 const result=page.waitForResponse(r=>r.url().endsWith('/word'));
 const download=page.waitForEvent('download',{timeout:60000});
 await page.getByRole('button',{name:'ดาวน์โหลด Word',exact:true}).click();
 const file=await download,response=await result;
 expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('wordprocessingml.document');
 expect(file.suggestedFilename()).toBe(subject+'.docx');
 const zip=await JSZip.loadAsync(fs.readFileSync((await file.path())!)),xml=await zip.file('word/document.xml')!.async('string');
 expect(xml.replaceAll('\u200b','')).toContain('จึงเรียนมาเพื่อโปรดพิจารณาเข้าร่วมประชุม');
 expect(xml).not.toContain('w:altChunk');
 await expect(page.locator('.toast[role="status"]')).toContainText('ดาวน์โหลด Word แล้ว');
 if(template.id==='internal')expect(xml.match(/<w:sectPr>/g)?.length).toBe(2);
 // A second export must use the newest unsaved form values, not the first download.
 if(template.id==='external'){
  await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject+' แก้ไขล่าสุด');
  const second=page.waitForEvent('download',{timeout:60000});
  await page.getByRole('button',{name:'ดาวน์โหลด Word',exact:true}).click();
  const newer=await JSZip.loadAsync(fs.readFileSync((await (await second).path())!));
  expect(await newer.file('word/document.xml')!.async('string')).toContain('แก้ไขล่าสุด');
 }
});

test('Word route rejects malformed and absent document IDs',async({request})=>{
 expect((await request.get('/api/documents/not-a-uuid/word')).status()).toBe(400);
 expect((await request.get('/api/documents/00000000-0000-4000-8000-000000000999/word')).status()).toBe(404);
});
