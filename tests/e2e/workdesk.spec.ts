import {test,expect} from '@playwright/test';
import fs from 'node:fs';

test('tasks persist, complete, undo and archive without losing the original record',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated data only');page.on('dialog',d=>d.accept());await page.goto('/home');
 const title='ติดตามหนังสือโครงการทดสอบ';await page.getByLabel('เพิ่มงานด่วน',{exact:true}).fill(title);await page.getByLabel('เพิ่มงานด่วน',{exact:true}).press('Enter');
 const task=page.getByRole('checkbox',{name:'ทำเสร็จ: '+title,exact:true});await expect(task).toBeVisible();await page.reload();await expect(task).toBeVisible();await task.click();await expect(task).toHaveCount(0);
 await page.getByRole('button',{name:'เลิกทำ',exact:true}).click();await expect(task).not.toBeChecked();
 await page.getByRole('button',{name:'เก็บไว้: '+title,exact:true}).click();await page.getByLabel('มุมมองรายการงาน',{exact:true}).selectOption('archived');await expect(page.getByRole('button',{name:'นำกลับ: '+title,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'นำกลับ: '+title,exact:true}).click();await page.getByLabel('มุมมองรายการงาน',{exact:true}).selectOption('open');await expect(task).toBeVisible();
 await page.screenshot({path:'output/workdesk-home.png',fullPage:true});
});

test('annual starter produces editable project tasks and a single next-year copy',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated data only');page.on('dialog',d=>d.accept());await page.goto('/?view=projects');
 const starters=page.locator('details.wd-starters');if(!await starters.evaluate((el:HTMLDetailsElement)=>el.open))await starters.locator('summary').click();
 await page.getByRole('button',{name:/^กิจกรรมส่งเสริมคุณภาพชีวิตผู้สูงอายุ/}).click();
 const dialog=page.getByRole('dialog',{name:'เพิ่มโครงการ',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByLabel('ชื่อโครงการ',{exact:true}).fill('แผนผู้สูงอายุสำหรับทดสอบ');await dialog.getByLabel('ปีงบประมาณ',{exact:true}).fill('2570');await dialog.getByLabel('ผู้รับผิดชอบ',{exact:true}).fill('เจ้าหน้าที่ทดสอบ');await dialog.getByLabel('วันเริ่ม',{exact:true}).fill('2027-04-01');await dialog.getByLabel('กำหนดเสร็จ',{exact:true}).fill('2027-04-13');
 await dialog.getByRole('button',{name:'บันทึกโครงการ',exact:true}).click();await expect(dialog).not.toBeVisible();
 const detail=page.getByRole('region',{name:'รายละเอียดโครงการ'});await expect(detail.getByRole('checkbox')).toHaveCount(6);await detail.getByRole('checkbox').first().click();await expect(detail.locator('.pd-summary')).toContainText('1/6');
 await page.screenshot({path:'output/workdesk-project.png',fullPage:true});
 await detail.getByRole('button',{name:'สร้างปีถัดไป',exact:true}).click();await expect(page.getByLabel('ปีงบประมาณ',{exact:true})).toHaveValue('2571');await expect(detail.getByRole('checkbox')).toHaveCount(6);await expect(detail.getByRole('checkbox',{checked:true})).toHaveCount(0);
 await page.getByRole('button',{name:'ปีงบประมาณก่อนหน้า',exact:true}).click();await page.locator('.wd-project-list').getByRole('button').filter({hasText:'แผนผู้สูงอายุสำหรับทดสอบ'}).click();await detail.getByRole('button',{name:'สร้างปีถัดไป',exact:true}).click();await expect(page.locator('.wd-project-list>button').filter({hasText:'แผนผู้สูงอายุสำหรับทดสอบ'})).toHaveCount(1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออกแผน CSV',exact:true}).click();const file=await download;const csv=fs.readFileSync((await file.path())!,'utf8');expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('แผนผู้สูงอายุสำหรับทดสอบ');expect(csv).toContain('2571');
 await detail.getByRole('button',{name:'พักโครงการ',exact:true}).click();await expect(page.locator('.wd-project-list>button')).toHaveCount(0);await page.getByLabel('ดูโครงการที่พักไว้',{exact:true}).check();await page.locator('.wd-project-list>button').click();await detail.getByRole('button',{name:'เปิดโครงการกลับมา',exact:true}).click();await page.getByLabel('ดูโครงการที่พักไว้',{exact:true}).uncheck();await expect(page.locator('.wd-project-list>button').filter({hasText:'แผนผู้สูงอายุสำหรับทดสอบ'})).toHaveCount(1);
});

for(const width of [320,375,414,768,1440])test('workdesk fits '+width,async({page})=>{
 await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/home');await expect(page.getByRole('heading',{name:'sarabun',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await expect(page.locator('.wd-tabs')).toHaveCSS('flex-direction','row');await page.screenshot({path:'output/workdesk-home-'+width+'.png',fullPage:true});
 await page.getByRole('navigation',{name:'มุมมองงาน'}).getByRole('button',{name:'โครงการรายปี',exact:true}).click();await expect(page.getByRole('heading',{name:'โครงการประจำปี',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.getByRole('button',{name:'เพิ่มโครงการ',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'เพิ่มโครงการ',exact:true});await expect(dialog).toBeVisible();expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(width);await page.screenshot({path:'output/workdesk-form-'+width+'.png',fullPage:true});
});

test('changing workdesk view warns before discarding a quick task',async({page})=>{
 await page.goto('/home');await page.getByLabel('เพิ่มงานด่วน',{exact:true}).fill('งานที่ยังไม่บันทึก');page.once('dialog',d=>d.dismiss());await page.getByRole('navigation',{name:'มุมมองงาน'}).getByRole('button',{name:'โครงการรายปี',exact:true}).click();await expect(page.getByLabel('เพิ่มงานด่วน',{exact:true})).toHaveValue('งานที่ยังไม่บันทึก');page.once('dialog',d=>d.accept());await page.getByRole('navigation',{name:'มุมมองงาน'}).getByRole('button',{name:'โครงการรายปี',exact:true}).click();await expect(page.getByRole('heading',{name:'โครงการประจำปี',exact:true})).toBeVisible();
});

test('Home uses capability headlines and preserves layout while typing',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/home');
 await expect(page.getByRole('heading',{level:1})).toHaveText('sarabun');
 await expect(page.getByText('วันนี้ เริ่มจากเรื่องสำคัญ',{exact:true})).toHaveCount(0);
 const rail=page.getByRole('group',{name:'เลือกงานในระบบ'});const before=await rail.boundingBox();
 const pause=page.getByRole('button',{name:'หยุดข้อความเคลื่อนไหว',exact:true});await expect(pause).toBeVisible();
 await page.waitForTimeout(1500);await pause.click();const typed=await page.getByTestId('welcome-typed').textContent();
 await page.waitForTimeout(400);expect(await page.getByTestId('welcome-typed').textContent()).toBe(typed);
 expect((await rail.boundingBox())!.y).toBe(before!.y);
 await rail.getByRole('button',{name:'โครงการประจำปี',exact:true}).click();
 await expect(page.getByRole('heading',{name:'โครงการประจำปี',exact:true})).toBeVisible();
});
