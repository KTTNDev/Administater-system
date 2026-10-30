import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
const digest=(s:string|null)=>createHash('sha256').update(s||'').digest('hex');

for(const width of [320,375,414,768,1440])test('welcome remains readable at '+width,async({page})=>{
 await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/home');
 await expect(page.getByRole('heading',{level:1})).toHaveText('เริ่มงานวันนี้ให้เป็นระเบียบขึ้น');
 await expect(page.getByTestId('welcome-typed')).toHaveText('ร่างบันทึกข้อความ');
 await expect(page.getByRole('button',{name:'หยุดข้อความเคลื่อนไหว'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:'output/calm-home-'+width+'.png',fullPage:true});
 await page.getByRole('link',{name:'เลือกแบบหนังสือ',exact:true}).click();await expect(page.locator('.template-card').first()).toBeVisible();
});

test('typewriter can pause without shifting the start button',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/home');
 const button=page.getByRole('button',{name:'หยุดข้อความเคลื่อนไหว'});await expect(button).toBeVisible();
 const before=await page.getByRole('link',{name:'เข้าสู่พื้นที่ทำงาน'}).boundingBox();
 await button.click();const text=await page.getByTestId('welcome-typed').textContent();await page.waitForTimeout(800);expect(await page.getByTestId('welcome-typed').textContent()).toBe(text);
 const after=await page.getByRole('link',{name:'เข้าสู่พื้นที่ทำงาน'}).boundingBox();expect(after?.y).toBe(before?.y);
});

test('collapsed sidebar hides every label and restores labels on mobile',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'ย่อแถบเมนู',exact:true}).click();
 for(const label of await page.locator('.sidebar .nav-label').all())await expect(label).toBeHidden();
 await expect(page.locator('.sidebar .drive-summary>span')).toBeHidden();await expect(page.locator('.sidebar .brand-copy')).toBeHidden();
 await page.getByRole('button',{name:'หน้าต้อนรับ',exact:true}).click();await expect(page.locator('#welcome-title')).toBeVisible();
 await page.screenshot({path:'output/calm-sidebar-collapsed.png',fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.getByRole('button',{name:'เปิดเมนู',exact:true}).click();
 for(const label of await page.locator('.sidebar .nav-label').all())await expect(label).toBeVisible();
 await expect(page.locator('.sidebar .brand-copy')).toBeVisible();await expect(page.locator('.sidebar .drive-summary>span')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
 await page.getByRole('button',{name:'ปิดเมนู',exact:true}).click();
});

test('saved document quick preview matches editor HTML and keyboard returns to its row',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Only create drafts in the isolated fixture');
 await page.goto('/?view=templates');await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role="status"]')).toContainText('บันทึก');
 const editor=page.locator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first()).toBeVisible();await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('body')).toContainText('ขออนุมัติจัดประชุมติดตามงาน');const hash=digest(await editor.getAttribute('srcdoc'));
 await page.getByRole('button',{name:'แดชบอร์ดเอกสาร',exact:true}).click();
 const peek=page.getByRole('button',{name:/^ดูตัวอย่าง /}).first();await peek.click();
 const panel=page.getByRole('dialog',{name:'ดูเอกสารอย่างรวดเร็ว'});await expect(panel).toBeVisible();
 const frame=page.locator('iframe[title="ตัวอย่างเอกสารจากรายการ"]');await expect.poll(async()=>digest(await frame.getAttribute('srcdoc'))).toBe(hash);
 await expect(page.frameLocator('iframe[title="ตัวอย่างเอกสารจากรายการ"]').locator('.page').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.screenshot({path:'output/calm-dashboard-preview.png',fullPage:true});
 await page.getByRole('button',{name:'ปิดตัวอย่างเอกสาร'}).press('Escape');await expect(panel).toHaveCount(0);await expect(peek).toBeFocused();
 await page.screenshot({path:'output/calm-dashboard.png',fullPage:true});
 await page.setViewportSize({width:375,height:900});await peek.click();await expect(panel).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
 await expect(page.frameLocator('iframe[title="ตัวอย่างเอกสารจากรายการ"]').locator('.page').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect.poll(async()=>(await panel.boundingBox())!.y).toBe(72);
 expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(920);
 await page.screenshot({path:'output/calm-preview-mobile.png',fullPage:true});
});

for(const width of [375,1440])test('workspace destinations remain usable at '+width,async({page})=>{
 await page.setViewportSize({width,height:960});await page.goto('/');
 for(const label of ['แดชบอร์ดเอกสาร','แบบหนังสือราชการ','ภาพรวมและรายงาน','พัสดุและครุภัณฑ์','ทะเบียนรับ–ส่งหนังสือ','งานธุรการเทศบาล','โอนงบประมาณ','ปฏิทินงาน','จองห้องประชุม','คลังกฎหมายและระเบียบ','คู่มือและแหล่งอ้างอิง','ตั้งค่าหน่วยงานและ Drive']){
  if(width<=900)await page.getByRole('button',{name:'เปิดเมนู',exact:true}).click();
  const item=page.locator('.sidebar').getByRole('button',{name:label,exact:true,includeHidden:true});await item.click();await expect(item).toHaveAttribute('aria-current','page');
  await expect(page.locator('.workspace-loading')).toHaveCount(0);await expect(page.locator('.main-shell').getByRole('heading').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),label).toBeLessThanOrEqual(width);
 }
});

test('quick preview switches documents in place without opening the editor',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated fixture only');
 const subjects=['ตรวจสลับตัวอย่าง A','ตรวจสลับตัวอย่าง B'];
 for(const subject of subjects){
  await page.goto('/?view=templates');await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);
  await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role="status"]')).toContainText('บันทึก');
 }
 await page.getByRole('button',{name:'แดชบอร์ดเอกสาร',exact:true}).click();await page.getByRole('button',{name:'ดูตัวอย่าง '+subjects[0],exact:true}).click();
 const paper=page.frameLocator('iframe[title="ตัวอย่างเอกสารจากรายการ"]').locator('body');await expect(paper).toContainText(subjects[0]);
 await page.locator('button[title="ดูตัวอย่างเรื่องนี้"]').filter({hasText:subjects[1]}).click();await expect(paper).toContainText(subjects[1]);await expect(paper).not.toContainText(subjects[0]);
 await expect(page.getByRole('dialog',{name:'ดูเอกสารอย่างรวดเร็ว'})).toBeVisible();await expect(page.locator('.editor-main')).toHaveCount(0);
 await page.getByRole('button',{name:'เปิดแก้ไขเอกสาร',exact:true}).click();await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(subjects[1]);
});
