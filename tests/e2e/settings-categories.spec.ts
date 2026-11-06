import {test,expect,type Page} from '@playwright/test';
const category=(page:Page,name:string)=>page.getByRole('tablist',{name:'หมวดการตั้งค่า',exact:true}).getByRole('tab',{name,exact:true});
const appearance=(page:Page)=>page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});

test('switching categories preserves pending form values and shows unsaved markers',async({page})=>{
 await page.goto('/?view=settings');const panel=appearance(page);
 await panel.getByLabel('ชื่อปุ่มเมนู',{exact:true}).fill('เมนูที่กำลังแก้');
 await category(page,'ข้อมูลหน่วยงาน').click();await page.getByLabel('ชื่อส่วนราชการ',{exact:true}).fill('หน่วยงานทดสอบค้างไว้');
 await category(page,'คลังคำศัพท์').click();await page.getByLabel('คำ / คำคู่',{exact:true}).fill('ศัพท์ที่ยังไม่บันทึก');
 await category(page,'หน้าหลักและหน้าตา').click();
 await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toHaveValue('เมนูที่กำลังแก้');
 await expect(category(page,'หน้าหลักและหน้าตา').getByLabel('มีข้อมูลยังไม่บันทึก')).toBeVisible();
 await expect(category(page,'คลังคำศัพท์').getByLabel('มีข้อมูลยังไม่บันทึก')).toBeVisible();
 await panel.getByRole('tab',{name:'นาฬิกาและวันที่',exact:true}).click();
 await panel.getByRole('slider',{name:'ขนาดนาฬิกา',exact:true}).fill('80');
 await panel.getByRole('tab',{name:'เมนูทางลัด',exact:true}).click();await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toHaveValue('เมนูที่กำลังแก้');
 await panel.getByRole('button',{name:'ยกเลิกการแก้ไข',exact:true}).click();
 await expect(category(page,'หน้าหลักและหน้าตา').getByLabel('มีข้อมูลยังไม่บันทึก')).toHaveCount(0);
 await category(page,'ข้อมูลหน่วยงาน').click();await expect(page.getByLabel('ชื่อส่วนราชการ',{exact:true})).toHaveValue('หน่วยงานทดสอบค้างไว้');
 await category(page,'คลังคำศัพท์').click();await expect(page.getByLabel('คำ / คำคู่',{exact:true})).toHaveValue('ศัพท์ที่ยังไม่บันทึก');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'ไปหน้าหลัก',exact:true}).click();await expect(page.getByLabel('คำ / คำคู่',{exact:true})).toHaveValue('ศัพท์ที่ยังไม่บันทึก');
});

test('categories work by keyboard and display only the selected form',async({page})=>{
 await page.goto('/?view=settings');const first=category(page,'หน้าหลักและหน้าตา');await first.focus();await first.press('ArrowDown');
 await expect(category(page,'ข้อมูลหน่วยงาน')).toBeFocused();await expect(first).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('Enter');await expect(category(page,'ข้อมูลหน่วยงาน')).toHaveAttribute('aria-selected','true');await expect(appearance(page)).not.toBeVisible();
 await category(page,'ข้อมูลหน่วยงาน').press('End');await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'ความพร้อมใช้งานจริง'})).toBeVisible();
 await category(page,'ความพร้อมระบบ').press('Home');await page.keyboard.press('Enter');await expect(appearance(page)).toBeVisible();
 await expect(page.locator('[id^="workspace-settings-panel-"]:visible')).toHaveCount(1);
});

test('storage and connection settings remain accessible and retain pending paths',async({page})=>{
 await page.goto('/?view=settings');await category(page,'ที่เก็บและสำรองข้อมูล').click();
 await page.getByText('เปลี่ยนโฟลเดอร์ข้อมูลทั้งชุด',{exact:true}).click();const field=page.getByLabel('โฟลเดอร์ข้อมูลใหม่',{exact:false});await field.fill('C:\\pending-settings-only');
 await category(page,'Google Drive').click();await expect(page.getByRole('heading',{name:'Google Drive',exact:true})).toBeVisible();await expect(field).not.toBeVisible();
 await category(page,'ที่เก็บและสำรองข้อมูล').click();await expect(field).toHaveValue('C:\\pending-settings-only');await expect(page.getByRole('button',{name:'บันทึกตำแหน่ง',exact:true})).toBeEnabled();
 await page.screenshot({path:'output/settings-storage-categories.png',fullPage:true});
});

test('all settings categories fit narrow screens and keep navigation within the page',async({page})=>{
 for(const width of [320,375,414,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/?view=settings');
  for(const name of ['หน้าหลักและหน้าตา','ข้อมูลหน่วยงาน','รายการกรอกอัตโนมัติ','คลังคำศัพท์','Google Drive','ที่เก็บและสำรองข้อมูล','ความพร้อมระบบ']){
   await category(page,name).click();await expect(category(page,name)).toHaveAttribute('aria-selected','true');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await category(page,'หน้าหลักและหน้าตา').click();
  for(const name of ['เมนูทางลัด','พื้นหลังหน้าหลัก','นาฬิกาและวันที่','ส่วนหัวเมนู']){
   await appearance(page).getByRole('tab',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  if(width===375)await page.screenshot({path:'output/settings-categories-mobile.png',fullPage:true});
 }
 await appearance(page).getByRole('tab',{name:'เมนูทางลัด',exact:true}).click();await page.screenshot({path:'output/settings-categories-desktop.png',fullPage:true});
});
