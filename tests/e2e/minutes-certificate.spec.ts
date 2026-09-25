import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {newDraft} from '../../src/lib/document';
import {documentHtml} from '../../src/lib/render-document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png')};
test('agenda form reorders items and preserves both modes',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/');await page.getByRole('button',{name:'แบบหนังสือราชการ',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'รายงานการประชุม',exact:true})}).click();
 await page.getByLabel('รูปแบบเนื้อหารายงาน').selectOption('agenda');
 await page.getByRole('button',{name:'เพิ่มวาระการประชุม',exact:true}).click();
 await page.getByLabel('หัวข้อวาระ',{exact:true}).fill('เรื่องเสนอ');await page.getByLabel('ข้ออภิปราย / รายละเอียด').fill('รายละเอียดตัวอย่าง');
 await page.getByRole('button',{name:'เพิ่มวาระการประชุม',exact:true}).click();
 await page.getByLabel('หัวข้อวาระ',{exact:true}).nth(1).fill('เรื่องแจ้ง');await page.getByLabel('ข้ออภิปราย / รายละเอียด').nth(1).fill('รายละเอียดถัดไป');
 await page.getByRole('button',{name:'เลื่อนวาระ 2 ขึ้น',exact:true}).click();await expect(page.getByLabel('หัวข้อวาระ',{exact:true}).first()).toHaveValue('เรื่องแจ้ง');
 await page.getByLabel('รูปแบบเนื้อหารายงาน').selectOption('free');await page.getByLabel('รูปแบบเนื้อหารายงาน').selectOption('agenda');
 await expect(page.getByLabel('หัวข้อวาระ',{exact:true}).first()).toHaveValue('เรื่องแจ้ง');
 await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('#pages')).toContainText('ระเบียบวาระที่ 1  เรื่องแจ้ง');
 await page.screenshot({path:'output/minutes-editor-ui.png',fullPage:false});
});
test('long agendas retain all text and resolutions across A4 pages',async({page})=>{
 const meetingAgenda=Array.from({length:6},(_,i)=>({title:`หัวข้อ ${i+1}`,discussion:('ข้อความอภิปรายการประชุมและรายละเอียดที่ต้องบันทึก ').repeat(45)+`จบวาระ ${i+1}`,resolution:`เห็นชอบข้อเสนอ ${i+1}`,resolutionLabel:'มติที่ประชุม' as const}));
 await page.setContent(documentHtml({...newDraft('minutes'),firstPageTop:'25',numeralStyle:'thai',subject:'ตัวอย่างรายงานการประชุม',meetingNo:'1/2569',location:'ห้องประชุมเทศบาล',attendees:'ผู้เข้าประชุมตัวอย่าง',startTime:'09:00',endTime:'12:00',recorder:'ผู้จดตัวอย่าง',minutesMode:'agenda',meetingAgenda},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 expect(await page.locator('.page').count()).toBeGreaterThan(1);
 await expect(page.locator('.page').first().locator('.page-number')).toHaveCount(0);
 const text=await page.locator('#pages').innerText();for(const digit of '๑๒๓๔๕๖'){expect(text).toContain(`จบวาระ ${digit}`);expect(text).toContain(`เห็นชอบข้อเสนอ ${digit}`);}
 await page.locator('.page').first().screenshot({path:'output/minutes-agenda-preview.png'});
});
test('optional certificate photo measures 40 by 60 mm and stays in page bounds',async({page})=>{
 await page.setContent(documentHtml({...newDraft('certificate'),firstPageTop:'25',organization:'เทศบาลตัวอย่าง',number:'001/2569',body:'หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า บุคคลตัวอย่างเป็นเจ้าหน้าที่ของเทศบาล',signer:'ผู้ลงนามตัวอย่าง',position:'นายกเทศมนตรี',certificatePhotoArea:true,certificateRecipient:'บุคคลตัวอย่าง'},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 const size=await page.locator('.certificate-photo').boundingBox();expect(size!.width).toBeCloseTo(40*96/25.4,0);expect(size!.height).toBeCloseTo(60*96/25.4,0);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 await page.locator('.page').first().screenshot({path:'output/certificate-photo-preview.png'});
});
