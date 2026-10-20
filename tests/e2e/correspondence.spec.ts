import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {newRegister} from '../../src/lib/correspondence';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {PDFDocument} from 'pdf-lib';
const token=()=>`ทดสอบทะเบียน ${Date.now()}`;
async function openNew(page:import('@playwright/test').Page,direction='รับ'){
 await page.goto('/?view=register');await expect(page.getByRole('heading',{name:'ทะเบียนรับ–ส่งหนังสือ',exact:true})).toBeVisible();
 if(direction==='ส่ง')await page.getByRole('button',{name:'หนังสือส่ง',exact:true}).click();
 await page.getByRole('button',{name:`ลงทะเบียน${direction}`,exact:true}).click();return page.getByRole('form',{name:'กรอกทะเบียนหนังสือ'});
}
test('register receives, stamps, searches, edits with history, and exports real PDF and statistics',async({page,request})=>{
 const form=await openNew(page),subject=token();
 await form.getByLabel('กอง / หน่วยงานเจ้าของทะเบียน').fill(subject);await form.getByLabel('จาก',{exact:true}).fill('สำนักงานจังหวัด');await form.getByLabel('ถึง',{exact:true}).fill('กองช่าง');
 await form.getByLabel('เรื่อง',{exact:true}).fill(subject);await form.getByLabel('ที่',{exact:true}).fill('ภก 123/๗๘');await form.getByLabel('ผู้ลงรับ / ลงส่ง').fill('ผู้รับ ทดสอบ');
 await form.getByText('เอกสารประกอบและเรื่องที่เกี่ยวข้อง',{exact:true}).click();
 const attachment=await PDFDocument.create();attachment.addPage();await form.getByLabel('แนบหนังสือ / หลักฐานการรับส่ง (PDF หรือรูปภาพ)').setInputFiles({name:'หลักฐานรับหนังสือ.pdf',mimeType:'application/pdf',buffer:Buffer.from(await attachment.save())});await expect(form.getByRole('link',{name:'หลักฐานรับหนังสือ.pdf',exact:true})).toBeVisible();
 await form.getByRole('button',{name:'ประทับชื่อและลงทะเบียน'}).click();await expect(page.getByRole('status')).toContainText('บันทึกทะเบียนรับ เลข 1/');
 const stamp=await request.get((await form.getByRole('link',{name:'พิมพ์ตรารับ',exact:true}).getAttribute('href'))!);expect(stamp.status()).toBe(200);fs.writeFileSync('output/register-stamp.pdf',await stamp.body());
 await form.getByLabel('สถานะการดำเนินการ').selectOption('working');await form.getByLabel('ผู้รับผิดชอบเรื่อง').fill('ผู้ดำเนินการ คนใหม่');await form.getByLabel('ผู้ดำเนินการครั้งนี้').fill('ผู้ส่งต่อ ทดสอบ');await form.getByLabel('เหตุผล / รายละเอียดการแก้ไข').fill('ส่งต่อให้กองช่างตรวจสอบ');await form.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
 await expect(form.getByRole('heading',{name:'ประวัติรายการ (2)'})).toBeVisible();await expect(form.getByText('ผู้ลงรับ: ผู้รับ ทดสอบ',{exact:false})).toBeVisible();
 const historyUrl=await form.getByRole('link',{name:'ดาวน์โหลดประวัติ CSV'}).getAttribute('href');const history=await request.get(historyUrl!);expect(await history.text()).toContain('ผู้ส่งต่อ ทดสอบ');
 await form.getByRole('button',{name:'ปิดรายการ'}).click();await page.getByLabel('ค้นในทะเบียน',{exact:false}).fill(`${subject} 123/78`);await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
 const url=await page.getByRole('link',{name:'พิมพ์ / PDF'}).getAttribute('href');const pdf=await request.get(url!);expect(pdf.status()).toBe(200);expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBe(1);fs.writeFileSync('output/register-book.pdf',await pdf.body());
 await page.getByRole('button',{name:'สถิติและรายงาน',exact:true}).click();await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
 const statsPdf=await request.get((await page.getByRole('link',{name:'พิมพ์ / PDF'}).getAttribute('href'))!);expect(statsPdf.status()).toBe(200);fs.writeFileSync('output/register-statistics.pdf',await statsPdf.body());
 const csvUrl=await page.getByRole('link',{name:'Excel (CSV)'}).getAttribute('href');expect(await (await request.get(csvUrl!)).text()).toContain('"1","0","0","1","0"');
 await page.reload();await page.getByLabel('ค้นในทะเบียน',{exact:false}).fill(subject);await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
 await page.getByRole('table').getByRole('button').first().click();await expect(page.getByRole('heading',{name:'ประวัติรายการ (2)'})).toBeVisible();
});
test('outgoing book starts independently, cancellation retains numbers, and navigation protects edits',async({page})=>{
 const form=await openNew(page,'ส่ง'),subject=token();await form.getByLabel('กอง / หน่วยงานเจ้าของทะเบียน').fill(subject);await form.getByLabel('จาก',{exact:true}).fill('กองคลัง');await form.getByLabel('ถึง',{exact:true}).fill('เทศบาล');await form.getByLabel('เรื่อง',{exact:true}).fill(subject);await form.getByLabel('ผู้ลงรับ / ลงส่ง').fill('ผู้ส่ง ทดสอบ');await form.getByRole('button',{name:'ประทับชื่อและลงทะเบียน'}).click();await expect(page.getByRole('status')).toContainText('ทะเบียนส่ง เลข 1/');
 await form.getByLabel('สถานะการดำเนินการ').selectOption('cancelled');await form.getByLabel('เหตุผล / รายละเอียดการแก้ไข').fill('ยกเลิกก่อนส่งจริง');await form.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(form.getByRole('heading',{name:'ประวัติรายการ (2)'})).toBeVisible();
 await form.getByLabel('เรื่อง',{exact:true}).fill('ยังไม่บันทึก');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'แดชบอร์ดเอกสาร',exact:true}).click();await expect(form).toBeVisible();page.once('dialog',d=>d.accept());await form.getByRole('button',{name:'ปิดรายการ'}).click();await expect(form).toHaveCount(0);
 await page.getByRole('button',{name:'ลงทะเบียนส่ง',exact:true}).click();await form.getByLabel('กอง / หน่วยงานเจ้าของทะเบียน').fill(subject);await form.getByLabel('จาก',{exact:true}).fill('กองคลัง');await form.getByLabel('ถึง',{exact:true}).fill('เทศบาล');await form.getByLabel('เรื่อง',{exact:true}).fill('ส่งใหม่');await form.getByRole('button',{name:'ประทับชื่อและลงทะเบียน'}).click();await expect(page.getByRole('status')).toContainText('ทะเบียนส่ง เลข 2/');
});
for(const width of [320,375,414,768,1440])test(`register page and paper form fit ${width}px without outer horizontal overflow`,async({page})=>{
 await page.setViewportSize({width,height:900});const form=await openNew(page);
 await expect(form.getByLabel('เรื่อง',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await form.getByLabel('เรื่อง',{exact:true}).fill('ทดสอบหน้าจอ');await form.getByLabel('หมายเหตุ',{exact:true}).fill('ข้อความยาว '.repeat(100));await form.getByLabel('ผู้ลงรับ / ลงส่ง').scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`output/register-${width}.png`,fullPage:true});
});

test('ledger paginates while search and CSV still cover every matching record',async({page,request})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated release data');
 await page.goto('/?view=register');await expect(page.getByText('กำลังเปิดเล่มทะเบียน…',{exact:true})).toBeHidden();
 const department='ตรวจแบ่งหน้า '+Date.now(),input={...newRegister(department),from:'ต้นทาง',to:'ปลายทาง',subject:'ตรวจแบ่งหน้าทะเบียน'},now=new Date().toISOString();
 const database=new DatabaseSync(path.join(process.env.SARABUN_E2E_DATA_ROOT!,'data','sarabun.sqlite'));
 try{const insert=database.prepare('INSERT INTO correspondence_entries(id,department_key,direction,year,serial,data,version,created_at,updated_at,created_by,updated_by,request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');for(let i=1;i<=51;i++)insert.run(randomUUID(),department,'incoming',Number(input.registeredDate.slice(0,4)),i,JSON.stringify(input),1,now,now,'ทดสอบ','ทดสอบ',randomUUID());}finally{database.close();}
 await page.reload();await page.getByLabel('ค้นในทะเบียน',{exact:false}).fill(department);await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
 await page.getByRole('navigation',{name:'หน้าทะเบียน'}).getByRole('button',{name:'ถัดไป',exact:true}).click();await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
 const download=await request.get((await page.getByRole('link',{name:'Excel (CSV)'}).getAttribute('href'))!);expect((await download.text()).split('\r\n')).toHaveLength(52);
});
