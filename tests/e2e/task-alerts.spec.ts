import {test,expect,type Page} from '@playwright/test';
const bell=(page:Page)=>page.getByRole('button',{name:'แจ้งเตือนงาน',exact:true});
const panel=(page:Page)=>page.getByRole('region',{name:'รายการแจ้งเตือนงาน',exact:true});
async function newTask(page:Page,title:string){
 await page.goto('/?view=tasks');await page.getByRole('button',{name:'เพิ่มงาน',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'เพิ่มงาน',exact:true});await dialog.getByLabel('ชื่องาน',{exact:true}).fill(title);return dialog;
}
test('quiet reminders persist acknowledgement and snooze, then open the correct task',async({page})=>{
 const title='เตือนติดตามหนังสือ '+Date.now(),dialog=await newTask(page,title);
 await dialog.getByLabel('กำหนดเสร็จ',{exact:true}).fill('2020-01-01');await dialog.getByRole('button',{name:'บันทึกงาน',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(panel(page)).toHaveCount(0);await expect(bell(page).locator('.task-alert-badge')).toBeVisible();await bell(page).click();
 let row=panel(page).locator('.task-alert-item').filter({hasText:title});await expect(row).toContainText('เกินกำหนด');await expect(row).toHaveAttribute('data-read','false');
 await row.getByRole('button',{name:'รับทราบ',exact:true}).click();await expect(row).toHaveAttribute('data-read','true');
 await page.reload();await bell(page).click();row=panel(page).locator('.task-alert-item').filter({hasText:title});await expect(row).toContainText('รับทราบแล้ว');
 await row.getByText('เตือนอีกครั้งวันที่…',{exact:true}).click();await row.getByLabel('วันเตือนอีกครั้ง',{exact:true}).fill('2099-01-01');await row.getByRole('button',{name:'เลื่อนเตือน',exact:true}).click();
 await panel(page).getByText(/รายการที่เลื่อนเตือน/).click();await expect(row).toContainText('พักเตือนถึง 2099-01-01');await page.reload();await bell(page).click();await panel(page).getByText(/รายการที่เลื่อนเตือน/).click();await expect(row).toContainText('พักเตือนถึง 2099-01-01');
 await row.getByRole('button',{name:'กลับมาเตือน',exact:true}).click();await expect(row).toHaveAttribute('data-read','false');await row.locator('.task-alert-open').click();
 const edit=page.getByRole('dialog',{name:'แก้ไขงาน',exact:true});await expect(edit.getByLabel('ชื่องาน',{exact:true})).toHaveValue(title);await edit.getByRole('combobox',{name:'สถานะ',exact:true}).selectOption('done');await edit.getByRole('button',{name:'บันทึกงาน',exact:true}).click();await expect(edit).not.toBeVisible();
 await bell(page).click();await expect(panel(page).locator('.task-alert-item').filter({hasText:title})).toHaveCount(0);
});
test('deadline templates, holidays and custom reminder dates work in the task editor',async({page})=>{
 await page.goto('/home');await bell(page).click();await panel(page).getByRole('button',{name:'ตั้งค่าการแจ้งเตือนงาน',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'ตั้งค่าการแจ้งเตือนงาน',exact:true});await settings.getByText('วันหยุดเพิ่มเติมสำหรับการนับวันทำการ',{exact:true}).click();await settings.getByRole('textbox',{name:'วันหยุด YYYY-MM-DD หนึ่งวันต่อบรรทัด',exact:true}).fill('2026-11-09');
 await settings.getByRole('button',{name:'เพิ่มแม่แบบ',exact:true}).click();const rule=settings.locator('.task-alert-rule').last();const label='ระยะเวลาภายในหน่วยงาน '+Date.now();await rule.getByLabel(/ชื่อแม่แบบที่/).fill(label);await rule.getByLabel('ระยะเวลา (วัน)',{exact:true}).fill('3');await rule.getByRole('combobox',{name:'นับวัน',exact:true}).selectOption('business');await rule.getByLabel('ระเบียบ / ข้อ / แหล่งอ้างอิง (ถ้ามี)',{exact:true}).fill('ตัวอย่างการทดสอบ ไม่ใช่ข้อกำหนดตามกฎหมาย');
 await settings.getByRole('button',{name:'บันทึกการแจ้งเตือน',exact:true}).click();await expect(settings).not.toBeVisible();
 const title='นับวันทำการ '+Date.now(),dialog=await newTask(page,title);await dialog.getByLabel('วันเริ่ม',{exact:true}).fill('2026-11-06');await dialog.getByText('กำหนดเวลาและการแจ้งเตือน',{exact:true}).click();
 await dialog.getByRole('combobox',{name:'วิธีกำหนดวันเสร็จ',exact:true}).selectOption('duration');await dialog.getByRole('combobox',{name:'เลือกแม่แบบระยะเวลา',exact:true}).selectOption({label});await expect(dialog.getByLabel('กำหนดเสร็จ',{exact:true})).toHaveValue('2026-11-12');await expect(dialog.getByLabel('กำหนดเสร็จ',{exact:true})).toHaveAttribute('readonly','');
 await dialog.getByRole('button',{name:'เพิ่มวันเตือนที่กำหนดเอง',exact:true}).click();await dialog.getByLabel('วันเตือนเฉพาะที่ 1',{exact:true}).fill('2020-01-01');await dialog.getByRole('button',{name:'บันทึกงาน',exact:true}).click();await expect(dialog).not.toBeVisible();
 await bell(page).click();const row=panel(page).locator('.task-alert-item').filter({hasText:title});await expect(row).toBeVisible();await row.locator('.task-alert-open').click();const edit=page.getByRole('dialog',{name:'แก้ไขงาน',exact:true});await expect(edit.getByLabel('กำหนดเสร็จ',{exact:true})).toHaveValue('2026-11-12');await expect(edit.getByLabel('วันเตือนเฉพาะที่ 1',{exact:true})).toHaveValue('2020-01-01');
 // A settings dialog opened from a task must return focus to the still-open task.
 await edit.getByRole('button',{name:'จัดการแม่แบบและวันหยุด',exact:true}).click();await expect(settings).toBeVisible();await settings.getByText('วันหยุดเพิ่มเติมสำหรับการนับวันทำการ',{exact:true}).click();await settings.getByRole('textbox',{name:'วันหยุด YYYY-MM-DD หนึ่งวันต่อบรรทัด',exact:true}).fill('');await settings.getByRole('button',{name:'บันทึกการแจ้งเตือน',exact:true}).click();await expect(settings).not.toBeVisible();await expect(edit).toBeVisible();await expect(edit.getByLabel('กำหนดเสร็จ',{exact:true})).toHaveValue('2026-11-12');
});
test('the bell fits narrow screens and fullscreen, and preserves document editing',async({page})=>{
 const seed=await newTask(page,'ตรวจรักษาตัวอย่างเอกสาร '+Date.now());await seed.getByLabel('กำหนดเสร็จ',{exact:true}).fill('2020-01-01');await seed.getByRole('button',{name:'บันทึกงาน',exact:true}).click();await expect(seed).not.toBeVisible();
 await page.setViewportSize({width:320,height:900});await page.goto('/home');await expect(bell(page)).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await bell(page).click();const box=(await panel(page).boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);await page.screenshot({path:'output/task-alert-mobile.png'});await page.getByRole('button',{name:'ปิดแจ้งเตือนงาน',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'เปิดโหมดเต็มจอ',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await expect(bell(page)).toBeInViewport();await page.getByRole('button',{name:'ออกจากโหมดเต็มจอ',exact:true}).click();
 await page.goto('/?view=templates');await page.locator('.template-feature').first().click();await page.locator('#document-body').fill('ตรวจรักษาเนื้อหาเอกสารระหว่างดูแจ้งเตือน');const frame=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(frame.locator('.body-text').filter({hasText:'ตรวจรักษาเนื้อหาเอกสาร'})).toBeVisible();
 await bell(page).click();const anyRow=panel(page).locator('.task-alert-open').first();await expect(anyRow).toBeVisible();page.once('dialog',d=>d.dismiss());await anyRow.click();await expect(page.locator('#document-body')).toHaveValue('ตรวจรักษาเนื้อหาเอกสารระหว่างดูแจ้งเตือน');await expect(frame.locator('.body-text').filter({hasText:'ตรวจรักษาเนื้อหาเอกสาร'})).toBeVisible();await page.getByRole('button',{name:'ปิดแจ้งเตือนงาน',exact:true}).click();await page.screenshot({path:'output/task-alert-preview-preserved.png'});
});
test('background polling does not let an open settings dialog overwrite another tab',async({page,context})=>{
 async function openSettings(p:Page){await p.goto('/home');await bell(p).click();await panel(p).getByRole('button',{name:'ตั้งค่าการแจ้งเตือนงาน',exact:true}).click();return p.getByRole('dialog',{name:'ตั้งค่าการแจ้งเตือนงาน',exact:true})}
 const first=await openSettings(page);await first.getByLabel('วันเตือนล่วงหน้าเริ่มต้น',{exact:true}).fill('14, 3, 0');
 const secondPage=await context.newPage(),second=await openSettings(secondPage);await second.getByLabel('วันเตือนล่วงหน้าเริ่มต้น',{exact:true}).fill('7, 1, 0');await second.getByRole('button',{name:'บันทึกการแจ้งเตือน',exact:true}).click();await expect(second).not.toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForLoadState('networkidle');await first.getByRole('button',{name:'บันทึกการแจ้งเตือน',exact:true}).click();await expect(first.getByRole('alert')).toContainText('ตั้งค่าถูกแก้ไขจากหน้าต่างอื่น');
 page.once('dialog',d=>d.accept());await first.getByRole('button',{name:'ยกเลิก',exact:true}).click();await secondPage.close();
});
