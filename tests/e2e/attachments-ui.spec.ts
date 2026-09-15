import {test,expect} from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
test('upload, preview, save and export a cover with its attachments',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.getByRole('button',{name:/หนังสือภายใน/}).first().click();
 const subject=`ข้อมูลสาธิต — บันทึกพร้อมเอกสารแนบ ${Date.now()}`;
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);
 const pdf=await PDFDocument.create();pdf.addPage([400,500]).drawText('DEMO - Agenda page 1',{x:30,y:450,size:16});pdf.addPage([500,400]).drawText('DEMO - Agenda page 2',{x:30,y:350,size:16});
 await page.getByLabel('เพิ่ม PDF หรือรูปภาพ').setInputFiles({name:'กำหนดการสาธิต.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
 await expect(page.locator('.attachment-card')).toContainText('2 หน้า');
 await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.body-text')).toContainText('ตามเอกสารที่แนบมาพร้อมนี้');
 await page.locator('.attachment-preview').scrollIntoViewIfNeeded();await expect(page.locator('.attachment-preview canvas[data-rendered="true"]').first()).toBeVisible();
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.getByRole('status')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();const file=await download;const savedPath=await file.path();const merged=await PDFDocument.load(fs.readFileSync(savedPath!));expect(merged.getPageCount()).toBe(3);expect(merged.getPages().slice(-2).map(p=>p.getWidth())).toEqual([400,500]);
 await file.saveAs('output/attachment-demo.pdf');await page.screenshot({path:'output/attachment-workspace.png',fullPage:true});
 await page.getByRole('button',{name:'เอาออกจากร่าง'}).click();await expect(page.locator('.attachment-preview')).toHaveCount(0);await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.content')).not.toContainText('ตามเอกสารที่แนบมาพร้อมนี้');
 // Return to the saved demo; removing a file from the draft does not delete stored attachments.
 page.on('dialog',d=>d.accept());await page.reload();
});
