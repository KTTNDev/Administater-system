import {test,expect} from '@playwright/test';

test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Use disposable release data');
for(const width of [1440,1024,960,390])test(`image appendix stays inside its scroll container at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 await page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'}).getByRole('button',{name:'หนังสือภายใน',exact:true}).click();
 await page.locator('.appendix-editor > summary').click();
 await page.getByLabel('เพิ่มภาพ PNG หรือ JPEG').setInputFiles('tests/fixtures/signature-synthetic.png');
 await expect(page.locator('.appendix-image-card')).toHaveCount(1);
 const root=()=>page.evaluate(()=>({height:document.documentElement.clientHeight,scroll:document.documentElement.scrollHeight,top:scrollY}));
 if(width>1000){
  await expect.poll(async()=>{const r=await root();return r.scroll-r.height}).toBeLessThanOrEqual(1);
  const form=page.locator('.form-pane');const box=(await form.boundingBox())!;
  await page.mouse.move(box.x+8,box.y+150);await page.mouse.wheel(0,100000);
  await expect.poll(()=>form.evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop)).toBeLessThanOrEqual(3);
  await page.mouse.wheel(0,800);expect((await root()).top).toBe(0);
  const before=await form.evaluate(e=>e.scrollTop),paper=page.locator('.paper-scroll'),paperBox=(await paper.boundingBox())!;
  await page.mouse.move(paperBox.x+paperBox.width/2,paperBox.y+80);await page.mouse.wheel(0,100000);
  await expect.poll(()=>paper.evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop)).toBeLessThanOrEqual(3);
  expect(await form.evaluate(e=>e.scrollTop)).toBe(before);expect((await root()).top).toBe(0);
 }else{
  await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'แนบท้าย',exact:true}).click();
  await expect.poll(()=>page.locator('#form-attachments').evaluate(e=>e.getBoundingClientRect().top)).toBeLessThan(500);
  expect((await root()).top).toBeGreaterThan(0);
 }
 await page.screenshot({path:`output/appendix-scroll-${width}.png`});
});
