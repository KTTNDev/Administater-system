import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {budgetSample} from '../../src/lib/budget';
import {budgetDraft} from '../../src/lib/budget-document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png')};
test('budget pattern paginates all entries, totals and five opinions',async({page})=>{
 const b=budgetSample('2026-09-15');b.signer='ผู้เสนอ (ตัวอย่าง)';b.position='เจ้าพนักงานธุรการ';
 await page.setContent(documentHtml(budgetDraft(b),assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 await expect(page.locator('.page').first().locator('.page-number')).toHaveCount(0);
 expect(await page.locator('.budget-line').count()).toBe(49);
 await expect(page.locator('body')).toContainText('๑๒๘,๕๔๐.๐๐');await expect(page.locator('body')).toContainText('ความเห็นนายกเทศมนตรี');
 fs.mkdirSync('output/pdf',{recursive:true});await page.pdf({path:'output/pdf/budget-transfer-pattern.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
 await page.locator('.page').first().screenshot({path:'output/budget-pattern-first.png'});await page.locator('.page').last().screenshot({path:'output/budget-pattern-last.png'});
});
test('budget screen loads pattern and prevents incomplete generation',async({page})=>{
 await page.goto('/?view=budget');await page.getByRole('button',{name:'ลองแพตเทิร์นจากไฟล์ตัวอย่าง'}).click();
 await expect(page.getByRole('button',{name:'สร้าง / เปิดบันทึกข้อความ'})).toBeDisabled();
 await page.getByLabel('ผู้เสนอ / ผู้ลงนาม',{exact:true}).fill('ผู้เสนอ (ทดสอบ)');await page.getByLabel('ตำแหน่ง',{exact:true}).first().fill('เจ้าพนักงานธุรการ');
 await page.getByLabel('ตรวจผู้มีอำนาจและข้อระเบียบที่ใช้กับรายการนี้แล้ว').check();await expect(page.getByRole('button',{name:'สร้าง / เปิดบันทึกข้อความ'})).toBeDisabled();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'output/budget-workspace.png'});
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:/แดชบอร์ดเอกสาร/}).click();await expect(page.getByRole('heading',{name:'โอนงบประมาณ',exact:true})).toBeVisible();
});
