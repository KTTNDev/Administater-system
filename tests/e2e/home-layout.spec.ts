import {test,expect,type Page} from '@playwright/test';

async function settings(page:Page){await page.goto('/?view=settings');const panel=page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});await expect(panel).toBeVisible();return panel;}
async function reset(page:Page){const panel=await settings(page);await panel.getByRole('button',{name:'คืนค่าเริ่มต้น',exact:true}).click();const save=panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true});if(await save.isEnabled()){await save.click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');}}
test.beforeEach(async({page})=>{await reset(page);});
test.afterEach(async({page})=>{await reset(page);});

test('adds, orders, hides and renames menu cards, persists options and navigates to the selected module',async({page})=>{
 const panel=await settings(page);await panel.getByRole('combobox',{name:'เลือกเมนูที่จะเพิ่ม',exact:true}).selectOption('inventory');await panel.getByRole('button',{name:'เพิ่มทางลัด',exact:true}).click();
 await panel.getByLabel('ชื่อปุ่มเมนู',{exact:true}).fill('คลังวัสดุของกอง');await panel.getByRole('combobox',{name:'พื้นหลังการ์ด',exact:true}).selectOption('solid');await panel.getByRole('combobox',{name:'โทนสี',exact:true}).selectOption('calendar');
 await panel.getByRole('button',{name:'เลื่อนทางลัดขึ้น',exact:true}).click();await panel.getByRole('button',{name:'เลื่อนทางลัดขึ้น',exact:true}).click();await panel.getByRole('button',{name:'เลื่อนทางลัดขึ้น',exact:true}).click();
 await panel.getByLabel('แสดงทางลัด งานของฉัน',{exact:true}).uncheck();
 await panel.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();await panel.getByLabel('ชื่อที่แสดงบนหน้าหลัก',{exact:true}).fill('สวัสดิการสังคม');await panel.getByRole('combobox',{name:'ขนาดการ์ด',exact:true}).selectOption('compact');
 for(const label of ['ข้อความความสามารถระบบ','นาฬิกาและวันที่','แถบสรุปงานวันนี้','รายการงาน','โครงการประจำปี','ทางลัดเลือกแบบหนังสือ'])await panel.getByRole('checkbox',{name:label,exact:true}).uncheck();
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');await expect(page.locator('#wd-home-title')).toHaveText('สวัสดิการสังคม');const cards=page.getByRole('group',{name:'เลือกงานในระบบ',exact:true});await expect(cards.locator('button')).toHaveCount(3);await expect(cards.locator('button').first()).toHaveText('คลังวัสดุของกอง');await expect(cards.locator('button',{hasText:'งานของฉัน'})).toHaveCount(0);
 await expect(page.locator('.wd-hero-date')).toHaveCount(0);await expect(page.locator('.wd-summary-strip')).toHaveCount(0);await expect(page.locator('.wd-home-grid>.wd-panel')).not.toBeVisible();await expect(page.locator('.wd-home-aside')).not.toBeVisible();await expect(cards).toHaveAttribute('data-card-size','compact');
 await page.reload();await expect(cards.locator('button').first()).toHaveText('คลังวัสดุของกอง');await cards.getByRole('button',{name:'คลังวัสดุของกอง',exact:true}).click();await expect(page.locator('.breadcrumbs strong')).toHaveText('พัสดุและครุภัณฑ์');
});

test('uploads, displays and removes local card and hero backgrounds',async({page})=>{
 const panel=await settings(page);await panel.getByRole('combobox',{name:'พื้นหลังการ์ด',exact:true}).selectOption('image');await panel.getByLabel('รูปพื้นหลังการ์ด',{exact:true}).setInputFiles('public/media/home-coast-poster.png');await expect(panel.getByRole('status')).toContainText('เตรียมรูปแล้ว');
 await panel.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();await panel.getByRole('combobox',{name:'พื้นหลังส่วนหัว',exact:true}).selectOption('image');await panel.getByLabel('รูปพื้นหลังส่วนหัว',{exact:true}).setInputFiles('public/media/home-coast-poster.png');await expect(panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');const card=page.locator('.home-custom-shortcuts [data-home-card]').first();expect(await card.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('data:image/webp;base64,');await expect(page.locator('.home-custom-hero-image')).toBeVisible();expect(await page.locator('.home-custom-hero-image').getAttribute('style')).toContain('data:image/webp;base64,');
 const reopened=await settings(page);await reopened.getByRole('button',{name:'ลบรูปการ์ด',exact:true}).click();await reopened.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();await reopened.getByRole('button',{name:'ลบรูปส่วนหัว',exact:true}).click();await reopened.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(reopened.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');await page.goto('/home');expect(await page.locator('.home-custom-shortcuts [data-home-card]').first().evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toBe('none');await expect(page.locator('.home-custom-hero-image')).toHaveCount(0);
});

test('protects settings changed in another tab and lets the user explicitly reload them',async({page,context})=>{
 const first=await settings(page);const secondPage=await context.newPage();const second=await settings(secondPage);
 await first.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();await first.getByLabel('ชื่อที่แสดงบนหน้าหลัก',{exact:true}).fill('หน้าหลัก A');
 await second.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();await second.getByLabel('ชื่อที่แสดงบนหน้าหลัก',{exact:true}).fill('หน้าหลัก B');
 await first.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(first.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');await second.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(second.getByRole('alert')).toContainText('หน้าต่างอื่น');
 secondPage.once('dialog',dialog=>dialog.accept());await second.getByRole('button',{name:'โหลดค่าที่บันทึก',exact:true}).click();await expect(second.getByLabel('ชื่อที่แสดงบนหน้าหลัก',{exact:true})).toHaveValue('หน้าหลัก A');await expect(second.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true})).toBeDisabled();await secondPage.close();
});

test('allows removing all shortcuts without losing access to settings or sidebar menus',async({page})=>{
 const panel=await settings(page);for(let i=0;i<3;i++)await panel.getByRole('button',{name:'ลบทางลัดที่เลือก',exact:true}).click();await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');await page.goto('/home');await expect(page.locator('.home-custom-shortcuts')).toHaveCount(0);await page.getByRole('button',{name:'เพิ่มทางลัดในตั้งค่า',exact:true}).click();await expect(page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true})).toBeVisible();await expect(page.getByRole('navigation').getByRole('button',{name:/พัสดุและครุภัณฑ์/})).toBeVisible();
});

test('warns before leaving unsaved settings and can discard only the pending changes',async({page})=>{
 const panel=await settings(page);await panel.getByLabel('ชื่อปุ่มเมนู',{exact:true}).fill('ยังไม่บันทึก');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('navigation').getByRole('button',{name:'โต๊ะทำงานวันนี้',exact:true}).click();await expect(panel).toBeVisible();await panel.getByRole('button',{name:'ยกเลิกการแก้ไข',exact:true}).click();await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toHaveValue('หนังสือราชการ');await expect(panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true})).toBeDisabled();
});

test('settings and Home fit mobile widths without horizontal page scrolling',async({page})=>{
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:900});const panel=await settings(page);await panel.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toBeVisible();
  await page.goto('/home');await expect(page.locator('.home-custom-shortcuts')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1100});await settings(page);await page.screenshot({path:'output/home-layout-settings.png',fullPage:true});await page.goto('/home');await page.screenshot({path:'output/home-layout-home.png',fullPage:true});
});
