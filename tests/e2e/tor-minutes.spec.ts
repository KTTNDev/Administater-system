import {test,expect} from '@playwright/test';import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';import {torMeetingFixture} from '../fixtures/tor-minutes';
const font=(file:string)=>'data:font/ttf;base64,'+fs.readFileSync('public/fonts/'+file).toString('base64');
const assets={regular:font('THSarabunNew.ttf'),bold:font('THSarabunNew-Bold.ttf'),garuda:'',routingStamp:'',copyMark:''};
test('TOR attendance, long details and signer groups survive pagination',async({page})=>{
 await page.setContent(documentHtml(torMeetingFixture(true),assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 expect(await page.locator('.page').count()).toBeGreaterThan(3);
 expect(await page.locator('.minutes-attendance').count()).toBeGreaterThan(1);
 const text=await page.locator('#pages').innerText();for(let i=1;i<=40;i++)expect(text).toContain('กรรมการตัวอย่าง '+i);for(let i=1;i<=8;i++)expect(text).toContain('จบหัวข้อ TOR '+i);
 expect(await page.locator('.minutes-signature').count()).toBe(3);
 const fits=await page.locator('.minutes-signature').evaluateAll(nodes=>nodes.every(n=>{const a=n.getBoundingClientRect(),b=n.closest('.content')!.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1;}));expect(fits).toBe(true);
 expect(await page.locator('.content > .minutes-section-title:last-child').count()).toBe(0);
 fs.mkdirSync('output/tor-check',{recursive:true});await page.locator('.page').first().screenshot({path:'output/tor-check/tor-preview-first.png'});await page.locator('.page').last().screenshot({path:'output/tor-check/tor-preview-last.png'});
});
test('TOR form can apply presets, edit members, reorder sections, save and reopen',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated database');page.on('dialog',d=>d.accept());
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'รายงานการประชุม',exact:true})}).click();
 await page.getByRole('combobox',{name:'แม่แบบรายงานการประชุม',exact:true}).selectOption('tor-purchase');await page.getByRole('button',{name:'ใช้แม่แบบนี้',exact:true}).click();
 await expect(page.getByLabel('รูปแบบรายชื่อผู้ประชุม')).toHaveValue('table');await expect(page.getByLabel('หัวข้อวาระ',{exact:true})).toHaveCount(5);
 await page.getByLabel('ชื่อการประชุม').fill('TOR-FORM-PERSIST');
 const members=page.locator('.minutes-members .agenda-card');await expect(members).toHaveCount(3);
 for(let i=0;i<3;i++){await members.nth(i).getByLabel('ชื่อ–นามสกุล',{exact:true}).fill('กรรมการทดสอบ '+i);await members.nth(i).getByLabel('ตำแหน่งราชการ').fill('เจ้าหน้าที่ทดสอบ');}
 await page.getByLabel('รายละเอียด TOR 1',{exact:true}).fill('รายละเอียดที่แก้ในฟอร์ม TOR');
 const second=page.locator('.tor-details details').nth(1);await second.locator('summary').click();await page.getByLabel('รายละเอียด TOR 2',{exact:true}).fill('วัตถุประสงค์ทดสอบ');await page.getByRole('button',{name:'เลื่อนหัวข้อ TOR 2 ขึ้น',exact:true}).click();
 await expect(page.locator('.tor-details details').first().getByLabel('ชื่อหัวข้อ TOR')).toHaveValue('วัตถุประสงค์');
 await page.getByLabel('ผู้จดรายงานการประชุม *',{exact:true}).fill('เลขานุการทดสอบ');await page.getByRole('button',{name:'เพิ่มจากกรรมการที่มาประชุม',exact:true}).click();await expect(page.locator('.minutes-signing .agenda-card')).toHaveCount(3);
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role="status"]')).toContainText('บันทึก');
 await page.reload();await page.getByText('TOR-FORM-PERSIST',{exact:true}).first().click();
 await expect(page.getByRole('combobox',{name:'แม่แบบรายงานการประชุม',exact:true})).toHaveValue('tor-purchase');await expect(page.locator('.tor-details details').first().getByLabel('ชื่อหัวข้อ TOR')).toHaveValue('วัตถุประสงค์');
 await page.screenshot({path:'output/tor-check/tor-form.png'});
});
