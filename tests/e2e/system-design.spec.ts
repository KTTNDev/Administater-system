import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/');
 await page.evaluate(()=>localStorage.removeItem('sarabun:sidebar-collapsed'));
 await page.reload();
});

test('every navigation group remains available with a consistent page layout',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const sidebar=page.getByRole('complementary',{name:'เมนูหลัก'});
 for(const group of ['เอกสาร','งานประจำ','คลังและการตั้งค่า'])await expect(sidebar.getByRole('navigation',{name:group,exact:true})).toBeVisible();
 const pages=[['แดชบอร์ดเอกสาร','dashboard'],['แบบหนังสือราชการ','templates'],['ภาพรวมและรายงาน','reports'],['งานธุรการเทศบาล','office'],['โอนงบประมาณ','budget'],['ปฏิทินงาน','calendar'],['จองห้องประชุม','bookings'],['คลังกฎหมายและระเบียบ','laws'],['คู่มือและแหล่งอ้างอิง','guide'],['ตั้งค่าหน่วยงานและ Drive','settings']];
 for(const [label,file] of pages){
  await sidebar.getByRole('button',{name:label,exact:true}).click();
  await expect(sidebar.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('main h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.screenshot({path:`output/system-design-${file}.png`});
 }
 await page.locator('.settings-disclosure > summary').click();
 await expect(page.getByRole('heading',{name:'พื้นที่จัดเก็บและซิงก์',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'ความพร้อมใช้งานจริง'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('sidebar collapse persists and search and document filters remain usable',async({page})=>{
 const sidebar=page.getByRole('complementary',{name:'เมนูหลัก'});
 await page.getByRole('button',{name:'ย่อแถบเมนู',exact:true}).click();
 await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
 await page.reload();
 await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
 await sidebar.getByRole('button',{name:'คลังกฎหมายและระเบียบ',exact:true}).click();
 await expect(page.locator('main h1')).toHaveText('คลังกฎหมายและระเบียบ');
 await page.getByRole('button',{name:'ขยายแถบเมนู',exact:true}).click();
 await page.keyboard.press('Control+k');
 await expect(page.getByRole('dialog',{name:'อยากทำอะไร?'})).toBeVisible();
 await page.keyboard.press('Escape');
 await sidebar.getByRole('button',{name:'แดชบอร์ดเอกสาร',exact:true}).click();
 await expect(page.locator('#document-filters')).toHaveAttribute('inert','');
 await page.getByRole('button',{name:'ตัวกรอง',exact:true}).click();
 await page.locator('#document-filters').getByLabel('ประเภท',{exact:true}).selectOption('internal');
 await expect(page.locator('#document-filters').getByLabel('ประเภท',{exact:true})).toHaveValue('internal');
 await page.getByRole('button',{name:/^ตัวกรอง/}).click();
 await expect(page.locator('#document-filters')).toHaveAttribute('inert','');
 await page.screenshot({path:'output/system-design-filtered.png'});
});

test('small screens support closing the menu with Escape and navigating without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const open=page.getByRole('button',{name:'เปิดเมนู',exact:true});
 await open.click();
 await expect(open).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');
 await expect(open).toHaveAttribute('aria-expanded','false');
 await expect(open).toBeFocused();
 await open.click();
 await page.getByRole('complementary',{name:'เมนูหลัก'}).getByRole('button',{name:'จองห้องประชุม',exact:true}).click();
 await expect(open).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('main h1')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'output/system-design-mobile.png',fullPage:true});
 await open.click();
 await expect(page.locator('.sidebar')).toHaveCSS('transform','none');
 expect(await page.locator('.sidebar-scroll').evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:'output/system-design-mobile-menu.png'});
});

test('document search, status filters and row actions fit narrow screens',async({page})=>{
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:900});
  const list=page.getByRole('region',{name:'รายการเอกสาร',exact:true});
  await expect(list).toBeVisible();
  await list.getByRole('textbox',{name:'ค้นหาเอกสารทุกข้อมูล'}).fill('คำค้นที่ไม่มีเอกสารทดสอบ');
  await expect(list.getByRole('heading',{name:'ไม่พบเอกสาร',exact:true})).toBeVisible();
  await list.getByRole('button',{name:'ล้างการค้นหา',exact:true}).click();
  const statuses=page.getByRole('region',{name:'สรุปสถานะเอกสาร'});
  await statuses.getByRole('button',{name:/กำลังร่าง/}).click();
  await expect(statuses.getByRole('button',{name:/กำลังร่าง/})).toHaveAttribute('aria-pressed','true');
  await statuses.getByRole('button',{name:/ทั้งหมด/}).click();
  const bounds=await list.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  const rowActions=list.locator('tbody tr').first().locator('td').last();
  if(await rowActions.count()){
   const box=await rowActions.boundingBox();
   expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  await page.screenshot({path:`output/hallmark-dashboard-${width}.png`,fullPage:true});
 }
});
