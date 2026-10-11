import {test,expect} from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
test('upload, preview, save and export a cover with its attachments',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 const subject=`ข้อมูลสาธิต — บันทึกพร้อมเอกสารแนบ ${Date.now()}`;
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);
 const pdf=await PDFDocument.create();pdf.addPage([400,500]).drawText('DEMO - Agenda page 1',{x:30,y:450,size:16});pdf.addPage([500,400]).drawText('DEMO - Agenda page 2',{x:30,y:350,size:16});
 await page.getByLabel('เพิ่ม PDF หรือรูปภาพ').setInputFiles({name:'กำหนดการสาธิต.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
 await expect(page.locator('.attachment-card')).toContainText('2 หน้า');
 await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.body-text')).toContainText('ตามเอกสารที่แนบมาพร้อมนี้');
 await page.locator('.attachment-preview').scrollIntoViewIfNeeded();await expect(page.locator('.attachment-preview canvas[data-rendered="true"]').first()).toBeVisible();
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role="status"]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();const file=await download;const savedPath=await file.path();const merged=await PDFDocument.load(fs.readFileSync(savedPath!));expect(merged.getPageCount()).toBe(3);expect(merged.getPages().slice(-2).map(p=>p.getWidth())).toEqual([400,500]);
 await file.saveAs('output/attachment-demo.pdf');await page.screenshot({path:'output/attachment-workspace.png',fullPage:true});
 await page.getByRole('button',{name:'เอาออกจากร่าง'}).click();await expect(page.locator('.attachment-preview')).toHaveCount(0);await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.content')).not.toContainText('ตามเอกสารที่แนบมาพร้อมนี้');
 // Return to the saved demo; removing a file from the draft does not delete stored attachments.
 page.on('dialog',d=>d.accept());await page.reload();
});

test('selecting two PDF attachments at once preserves both and their chosen order',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Use disposable data only.');
 await page.goto('/');
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill('ทดสอบไฟล์แนบหลายฉบับ '+Date.now());
 const first=await PDFDocument.create();first.addPage([400,500]);
 const second=await PDFDocument.create();second.addPage([500,400]);
 await page.getByLabel(/เพิ่ม PDF หรือรูปภาพ/).setInputFiles([
  {name:'เอกสาร-ก.pdf',mimeType:'application/pdf',buffer:Buffer.from(await first.save())},
  {name:'เอกสาร-ข.pdf',mimeType:'application/pdf',buffer:Buffer.from(await second.save())},
 ]);
 const cards=page.locator('.attachment-card');await expect(cards).toHaveCount(2);
 await expect(cards.nth(0)).toContainText('เอกสาร-ก.pdf');
 await expect(cards.nth(1)).toContainText('เอกสาร-ข.pdf');
 await cards.nth(1).getByTitle('เลื่อนขึ้น').click();
 await expect(cards.nth(0)).toContainText('เอกสาร-ข.pdf');
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();
 await expect(page.locator('.toast[role="status"]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();
 const file=await download,location=await file.path(),pdf=await PDFDocument.load(fs.readFileSync(location!));
 expect(pdf.getPageCount()).toBe(3);
 expect(pdf.getPages().slice(-2).map(item=>item.getWidth())).toEqual([500,400]);
});
