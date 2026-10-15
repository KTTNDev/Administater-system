import {test,expect} from '@playwright/test';
import {officeKinds} from '../../src/lib/office';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires disposable release data');
for(const [kind,label] of Object.entries(officeKinds))test(`office ${kind}: create, reopen and update`,async({page})=>{
 const title=`ตรวจงาน ${kind} ${Date.now()}`;
 await page.goto('/?view=office');await page.getByRole('navigation',{name:'หมวดงานธุรการ'}).getByRole('button',{name:new RegExp(label)}).click();
 await page.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();await page.getByLabel('ชื่อเรื่อง / ชื่องาน / ชื่อรายการ').fill(title);
 if(kind==='supplies'){await page.getByLabel('จำนวนคงเหลือ').fill('10');await page.getByLabel('หน่วยนับ').fill('ชุด');}
 await page.getByRole('button',{name:'บันทึกรายการ',exact:true}).click();await expect(page.getByRole('button',{name:title,exact:true})).toBeVisible();
 await page.reload();await page.getByRole('navigation',{name:'หมวดงานธุรการ'}).getByRole('button',{name:new RegExp(label)}).click();await page.getByRole('button',{name:title,exact:true}).click();
 await expect(page.getByLabel('ชื่อเรื่อง / ชื่องาน / ชื่อรายการ')).toHaveValue(title);await page.getByLabel('ชื่อเรื่อง / ชื่องาน / ชื่อรายการ').fill(title+' แก้ไข');
 await page.getByRole('button',{name:'บันทึกรายการ',exact:true}).click();await expect(page.getByRole('button',{name:title+' แก้ไข',exact:true})).toBeVisible();
});
test('calendar appointment survives reload',async({page})=>{
 const title='ตรวจนัดหมาย '+Date.now();await page.goto('/?view=calendar');await page.getByRole('button',{name:'เพิ่มนัดหมาย',exact:true}).click();
 const form=page.locator('dialog');await form.getByLabel('เรื่อง',{exact:true}).fill(title);await form.getByLabel('ทั้งวัน',{exact:true}).check();
 await form.getByRole('button',{name:'บันทึกนัดหมาย',exact:true}).click();await expect(page.getByRole('status')).toContainText('บันทึกนัดหมายแล้ว');await page.reload();await expect(page.getByText(title,{exact:true}).first()).toBeVisible();
});
test('room and booking survive reload',async({page})=>{
 const room='ห้องตรวจระบบ '+Date.now(),title='ตรวจการจอง '+Date.now();await page.goto('/?view=bookings');await page.getByRole('button',{name:'เพิ่มห้อง',exact:true}).click();
 await page.getByLabel('ชื่อห้อง').fill(room);await page.getByRole('button',{name:'บันทึกห้อง',exact:true}).click();
 const card=page.locator('.booking-room').filter({has:page.getByRole('heading',{name:room,exact:true})});await card.getByRole('button',{name:'เลือกห้องนี้',exact:true}).click();
 await page.getByLabel('หัวข้อการประชุม').fill(title);await page.getByLabel('จำนวนผู้เข้าร่วม').fill('5');await page.getByLabel('ผู้จอง / ผู้ประสานงาน').fill('ผู้ตรวจระบบ');
 await page.getByLabel('เริ่ม *',{exact:true}).fill('23:00');await page.getByLabel('สิ้นสุด *',{exact:true}).fill('23:30');
 await page.getByRole('button',{name:'บันทึกการจอง',exact:true}).click();await expect(page.getByRole('status')).toContainText('บันทึกการจองแล้ว');await page.reload();await expect(page.getByText(title,{exact:true}).first()).toBeVisible();
});
