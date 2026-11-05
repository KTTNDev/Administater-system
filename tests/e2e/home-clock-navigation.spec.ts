import {test,expect,type Page} from '@playwright/test';
async function setRange(page:Page,label:string,value:string){
 await page.getByRole('slider',{name:label,exact:true}).evaluate((el:HTMLInputElement,value)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 },value);
}
async function settings(page:Page){
 await page.goto('/?view=settings');
 const panel=page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});
 await expect(panel).toBeVisible();return panel;
}
async function reset(page:Page){
 const panel=await settings(page);
 await panel.getByRole('button',{name:'คืนค่าเริ่มต้น',exact:true}).click();
 const save=panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true});
 if(await save.isEnabled()){await save.click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');}
}
test.beforeEach(async({page})=>{await reset(page)});
test.afterEach(async({page})=>{await reset(page)});
test('restored Home puts full-size cards first and the control deck operates the sidebar at every width',async({page})=>{
 await page.goto('/home');
 const cards=page.getByRole('group',{name:'เลือกงานในระบบ',exact:true});
 const tasks=page.getByRole('region',{name:'To-do list หน้าหลัก',exact:true});
 expect((await cards.boundingBox())!.y).toBeLessThan((await tasks.boundingBox())!.y);
 expect((await cards.locator('[data-home-card]').first().boundingBox())!.height).toBeGreaterThanOrEqual(110);
 await expect(page.locator('.home-menu-zone')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'อยากทำอะไร?',exact:true})).toHaveCount(0);
 const menu=page.getByRole('navigation',{name:'นำทางระหว่างหน้า'}).getByRole('button',{name:'เปิดเมนู',exact:true});
 await menu.click();await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
 await menu.click();await expect(page.locator('.app-shell')).not.toHaveClass(/sidebar-collapsed/);
 await page.screenshot({path:'output/restored-home-control-deck.png',fullPage:true});
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:960});
  await expect(menu).toHaveAttribute('aria-expanded','false');
  await menu.click();
  await expect(page.getByRole('complementary',{name:'เมนูหลัก',exact:true})).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
test('clock fonts and independent sizes persist, load locally, and leave document paper unchanged',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 async function paper(){
  await page.goto('/?view=templates');await page.locator('.template-feature').first().click();
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
  const body=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('body');
  await expect(body.locator('.body-text').first()).toBeVisible();
  return body.evaluate(async el=>{await document.fonts.ready;return {text:(el as HTMLElement).innerText,width:el.scrollWidth,font:getComputedStyle(el).fontFamily,background:getComputedStyle(el).backgroundColor}});
 }
 const before=await paper();
 const panel=await settings(page);
 await expect(panel.locator('.home-clock-settings')).toHaveAttribute('open','');
 for(const [key,family] of [['kanit','HomeKanit'],['chakrapetch','HomeChakraPetch'],['ibmplexsansthai','HomeIBMPlexThai'],['mali','HomeMali']]){
  await panel.getByRole('combobox',{name:'ฟอนต์นาฬิกา',exact:true}).selectOption(key);
  expect(await page.evaluate(async family=>{await document.fonts.load('32px '+family,'กขค 12:34');return document.fonts.check('32px '+family,'กขค 12:34')},family)).toBe(true);
 }
 await panel.getByRole('combobox',{name:'ฟอนต์นาฬิกา',exact:true}).selectOption('chakrapetch');
 await panel.getByRole('combobox',{name:'ฟอนต์วันที่',exact:true}).selectOption('mali');
 for(const [label,value] of [['ขนาดนาฬิกา','88'],['ขนาดวันที่','28']]){
  await setRange(page,label,value);
 }
 const preview=panel.getByLabel('ตัวอย่างนาฬิกาและวันที่',{exact:true});
 await expect(preview.locator('time')).toHaveCSS('font-size','88px');
 await expect(preview.locator('.home-clock>span')).toHaveCSS('font-size','28px');
 await page.screenshot({path:'output/clock-type-settings.png',fullPage:true});
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');await expect(page.locator('.home-clock time')).toHaveCSS('font-size','88px');
 await expect(page.locator('.home-clock time')).toHaveCSS('font-family',/HomeChakraPetch/);
 await expect(page.locator('.home-clock>span')).toHaveCSS('font-family',/HomeMali/);
 await page.reload();await expect(page.locator('.home-clock time')).toHaveCSS('font-size','88px');
 expect(await paper()).toEqual(before);
 const updated=await settings(page);await expect(updated.locator('.home-clock-settings')).toHaveAttribute('open','');
 await setRange(page,'ขนาดนาฬิกา','112');
 await setRange(page,'ขนาดวันที่','40');
 await updated.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(updated.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');
 for(const width of [320,375,414,768,1440]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('.home-clock')).toBeVisible();
 }
 await page.screenshot({path:'output/restored-home-large-clock.png',fullPage:true});
});
