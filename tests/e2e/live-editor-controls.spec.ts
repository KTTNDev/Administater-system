import {test,expect} from '@playwright/test';
test('live editor keeps focus mode and responsive scroll after resizing',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'รายงานการประชุม',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้แม่แบบนี้',exact:true}).click();
 const divider=page.getByRole('separator',{name:'ปรับความกว้างพื้นที่กรอก'});
 await divider.focus();await divider.press('ArrowRight');
 await expect(divider).toHaveAttribute('aria-valuenow','48');
 await page.getByRole('button',{name:'โฟกัสการเขียน',exact:true}).click();
 await expect(divider).not.toBeVisible();
 await page.getByRole('button',{name:'แสดงตัวอย่างคู่กัน',exact:true}).click();
 await expect(divider).toBeVisible();
 const nav=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'});
 await nav.getByRole('button',{name:'เนื้อหา',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'เลือกวาระการประชุม'}).getByRole('button')).toHaveCount(5);
 // ชื่อ TOR จริงยาวกว่าแม่แบบ และต้องไม่ดันกรอบเมื่อผู้ใช้ย่อแผงกรอกเหลือ 35%
 await page.locator('.agenda-workspace').first().getByLabel('หัวข้อวาระ',{exact:true}).fill('พิจารณาร่างขอบเขตของงาน (TOR) / รายละเอียดคุณลักษณะเฉพาะโครงการกล้องวงจรปิดพร้อมติดตั้ง');
 for(const width of [1294,1440]){
  await page.setViewportSize({width,height:900});
  await divider.focus();await divider.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow','35');
  const dimensions=await page.locator('.form-pane').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
 }
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:900});
  await expect(divider).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const form=await page.locator('.form-pane').boundingBox(),preview=await page.locator('.preview-pane').boundingBox();
  expect(form!.y).toBeLessThan(preview!.y);
 }
});
