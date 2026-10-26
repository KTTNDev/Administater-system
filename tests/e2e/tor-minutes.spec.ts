import {test,expect} from '@playwright/test';import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';import {torMeetingFixture} from '../fixtures/tor-minutes';
import {PDFDocument} from 'pdf-lib';
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
 await page.goto('/');await page.getByRole('button',{name:'แบบหนังสือราชการ',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'รายงานการประชุม',exact:true})}).click();
 await page.getByRole('combobox',{name:'แม่แบบรายงานการประชุม',exact:true}).selectOption('tor-purchase');await page.getByRole('button',{name:'ใช้แม่แบบนี้',exact:true}).click();
 await expect(page.getByLabel('รูปแบบรายชื่อผู้ประชุม')).toHaveValue('table');await expect(page.getByLabel('หัวข้อวาระ',{exact:true})).toHaveCount(5);
 const subject='TOR-FORM-PERSIST-'+Date.now();await page.getByLabel('ชื่อการประชุม').fill(subject);
 await page.getByLabel('ครั้งที่ *',{exact:true}).fill('1/2569');await page.getByLabel('สถานที่ *',{exact:true}).fill('ห้องประชุมทดสอบ');
 await page.getByLabel('เริ่มประชุมเวลา').fill('09:00');await page.getByLabel('เลิกประชุมเวลา').fill('12:00');
 const members=page.locator('.minutes-members .agenda-card');await expect(members).toHaveCount(3);
 for(let i=0;i<3;i++){await members.nth(i).getByLabel('ชื่อ–นามสกุล',{exact:true}).fill('กรรมการทดสอบ '+i);await members.nth(i).getByLabel('ตำแหน่งราชการ').fill('เจ้าหน้าที่ทดสอบ');}
 await page.getByLabel('รายละเอียด TOR 1',{exact:true}).fill('รายละเอียดที่แก้ในฟอร์ม TOR');
 const second=page.locator('.tor-details details').nth(1);await second.locator('summary').click();await page.getByLabel('รายละเอียด TOR 2',{exact:true}).fill('วัตถุประสงค์ทดสอบ');await page.getByRole('button',{name:'เลื่อนหัวข้อ TOR 2 ขึ้น',exact:true}).click();
 await expect(page.locator('.tor-details details').first().getByLabel('ชื่อหัวข้อ TOR')).toHaveValue('วัตถุประสงค์');
 for(let i=0;i<5;i++)await page.getByRole('region',{name:'วาระที่ '+(i+1),exact:true}).getByRole('textbox',{name:'ข้ออภิปราย / รายละเอียด',exact:true}).fill('บันทึกข้ออภิปรายจริงของวาระ '+(i+1));
 for(let i=0;i<8;i++){const section=page.locator('.tor-details details').nth(i);await section.evaluate(el=>el.setAttribute('open',''));await page.getByLabel('รายละเอียด TOR '+(i+1),{exact:true}).fill('เนื้อหาหัวข้อ TOR '+(i+1)+' สำหรับทดสอบการบันทึกและส่งออก');}
 const speechDetails=page.locator('.minutes-speeches').nth(3);await speechDetails.locator('summary').click();await speechDetails.getByRole('button',{name:'เพิ่มผู้พูด / ข้อซักถาม',exact:true}).click();
 await page.getByLabel('ชื่อผู้พูด',{exact:true}).fill('กรรมการผู้ซักถาม');await page.getByRole('textbox',{name:'คำอภิปราย / ข้อซักถาม',exact:true}).fill('ข้อซักถามที่ต้องคงอยู่หลังเปิดกลับ');
 await page.getByLabel('ผู้จดรายงานการประชุม *',{exact:true}).fill('เลขานุการทดสอบ');await page.getByRole('button',{name:'เพิ่มจากกรรมการที่มาประชุม',exact:true}).click();await expect(page.locator('.minutes-signing .agenda-card')).toHaveCount(3);
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role="status"]')).toContainText('บันทึก');
 await page.reload();await page.getByText(subject,{exact:true}).first().click();
 await expect(page.getByRole('combobox',{name:'แม่แบบรายงานการประชุม',exact:true})).toHaveValue('tor-purchase');await expect(page.locator('.tor-details details').first().getByLabel('ชื่อหัวข้อ TOR')).toHaveValue('วัตถุประสงค์');
 await page.screenshot({path:'output/tor-check/tor-form.png'});
 await expect(page.getByRole('textbox',{name:'คำอภิปราย / ข้อซักถาม',exact:true})).toHaveValue('ข้อซักถามที่ต้องคงอยู่หลังเปิดกลับ');
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(preview.locator('#pages')).toContainText('เนื้อหาหัวข้อ TOR 8');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();const file=await download;
 fs.mkdirSync('output/tor-check',{recursive:true});await file.saveAs('output/tor-check/tor-ui-export.pdf');
 const pdf=await PDFDocument.load(fs.readFileSync('output/tor-check/tor-ui-export.pdf'));expect(pdf.getPageCount()).toBeGreaterThan(1);
});
