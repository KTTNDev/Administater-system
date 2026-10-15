import {test,expect} from '@playwright/test';

test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated release data');
test('reading view keeps search and exposes complete metadata on demand',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือ',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();const title='ทดสอบมุมมองอ่านง่าย '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(title);await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role=status]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');await page.getByRole('button',{name:'กลับรายการ',exact:true}).click();
 await page.getByLabel('ค้นหาเอกสารทุกข้อมูล').fill(title);
 const row=page.locator('tbody tr').filter({hasText:title});await expect(row).toHaveCount(1);await expect(row.locator('td').nth(2)).toBeHidden();
 const detail=page.getByRole('button',{name:'แสดงรายละเอียดเพิ่มเติม',exact:true});await detail.click();await expect(detail).toHaveAttribute('aria-pressed','true');await expect(row.locator('td').nth(2)).toBeVisible();await expect(page.getByLabel('ค้นหาเอกสารทุกข้อมูล')).toHaveValue(title);await detail.click();await expect(row.locator('td').nth(2)).toBeHidden();
 await page.screenshot({path:'output/comfort-dashboard.png'});
});

test('writing focus expands the form and preserves text when preview returns',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือ',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายนอก',exact:true})}).click();
 await page.locator('#document-body').fill('ข้อความต้องคงอยู่เมื่อสลับโหมดโฟกัสการเขียน');
 const normal=(await page.locator('.form-pane').boundingBox())!.width;
 await page.getByRole('button',{name:'โฟกัสการเขียน',exact:true}).click();await expect(page.locator('.preview-pane')).toBeHidden();expect((await page.locator('.form-pane').boundingBox())!.width).toBeGreaterThan(normal*1.5);
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'เนื้อหา',exact:true}).click();await expect.poll(()=>page.locator('#form-body').evaluate(e=>e.contains(document.activeElement))).toBe(true);
 await page.screenshot({path:'output/comfort-focus.png'});
 await page.getByRole('button',{name:'แสดงตัวอย่างคู่กัน',exact:true}).click();await expect(page.locator('.preview-pane')).toBeVisible();await expect(page.locator('#document-body')).toHaveValue('ข้อความต้องคงอยู่เมื่อสลับโหมดโฟกัสการเขียน');await expect(page.frameLocator('iframe').locator('.content')).toContainText('ข้อความต้องคงอยู่');
});

for(const width of [320,375,414,768])test(`all workspace pages fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 for(const label of ['แดชบอร์ดเอกสาร','แบบหนังสือราชการ','ภาพรวมและรายงาน','งานธุรการเทศบาล','โอนงบประมาณ','ปฏิทินงาน','จองห้องประชุม','คลังกฎหมายและระเบียบ','คู่มือและแหล่งอ้างอิง','ตั้งค่าหน่วยงานและ Drive']){
  await page.getByRole('button',{name:'เปิดเมนู',exact:true}).click();await page.getByRole('complementary',{name:'เมนูหลัก'}).getByRole('button',{name:label,exact:true}).click();await expect(page.locator('main h1')).toBeVisible();
  await expect.poll(async()=>{const bounds=await page.locator('main').boundingBox();return bounds!==null&&bounds.x>=0&&bounds.x+bounds.width<=width+1;},{message:label+' stays inside the viewport'}).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(label==='แบบหนังสือราชการ')await page.screenshot({path:`output/comfort-templates-${width}.png`});
 }
});
