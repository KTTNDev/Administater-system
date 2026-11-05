import {test,expect,type Page} from '@playwright/test';
import {homeCanvasInk} from '../../src/lib/home-canvas';
async function settings(page:Page){
 await page.goto('/?view=settings');
 const panel=page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});
 await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toBeEnabled();
 return panel;
}
async function reset(page:Page){
 const panel=await settings(page);await panel.getByRole('button',{name:'คืนค่าเริ่มต้น',exact:true}).click();
 const save=panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true});
 if(await save.isEnabled()){await save.click();await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว')}
}
async function save(page:Page){
 const panel=page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
}
async function customColor(page:Page,value:string){
 await page.getByLabel('สีพื้นหลังหน้าหลักที่กำหนดเอง',{exact:true}).evaluate((el:HTMLInputElement,value)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
 },value);
}
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());await reset(page)});
test.afterEach(async({page})=>{await reset(page)});
test('saved gray and custom colors change canvas text automatically while retaining solid original cards',async({page})=>{
 await page.goto('/home?homeLook=glass');
 await expect(page.locator('.home-appearance-trial')).toHaveCount(0);
 await expect(page.locator('.app-shell')).not.toHaveAttribute('data-home-appearance','glass');
 const card=page.locator('[data-home-card]').first();
 await page.mouse.move(0,0);
 const original=await card.evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,blur:c.backdropFilter}});
 for(const color of ['#292d32','#eeeeee','#777777','#3c255c']){
  const panel=await settings(page);
  if(color==='#292d32')await panel.getByRole('button',{name:'ชาร์โคล',exact:true}).click();else await customColor(page,color);
  const ink=homeCanvasInk(color)==='#ffffff'?'rgb(255, 255, 255)':'rgb(0, 0, 0)';
  await expect(panel.locator('.home-canvas-preview')).toHaveCSS('color',ink);
  await save(page);await page.goto('/home');await page.mouse.move(0,0);
  await expect(page.locator('.app-shell')).toHaveAttribute('data-home-canvas','true');
  for(const selector of ['.wd-eyebrow','.wd-summary-strip','.wd-summary-strip strong','.wd-tabs button','.workspace-page-context strong']){
   await expect(page.locator(selector).first()).toHaveCSS('color',ink);
  }
  expect(await card.evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,blur:c.backdropFilter}})).toEqual(original);
  await page.reload();await expect(page.locator('.main-shell')).toHaveCSS('background-color',color==='#292d32'?'rgb(41, 45, 50)':color==='#eeeeee'?'rgb(238, 238, 238)':color==='#777777'?'rgb(119, 119, 119)':'rgb(60, 37, 92)');
  if(color==='#292d32')await page.screenshot({path:'output/home-charcoal-canvas.png',fullPage:true});
 }
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:960});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
test('return to the original color and document rendering remain available after saving a dark Home',async({page})=>{
 async function paper(){
  await page.goto('/?view=templates');await page.locator('.template-feature').first().click();
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
  const body=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('body');
  await expect(body.locator('.body-text').first()).toBeVisible();
  return body.evaluate(async el=>{await document.fonts.ready;return {text:(el as HTMLElement).innerText,font:getComputedStyle(el).fontFamily,background:getComputedStyle(el).backgroundColor,width:el.scrollWidth}});
 }
 const before=await paper();
 let panel=await settings(page);await panel.getByRole('button',{name:'เกือบดำ',exact:true}).click();await save(page);
 await page.goto('/home');await expect(page.locator('.main-shell')).toHaveCSS('background-color','rgb(22, 24, 28)');
 expect(await paper()).toEqual(before);
 await expect(page.locator('.app-shell')).toHaveAttribute('data-home-canvas','false');
 panel=await settings(page);await panel.getByRole('button',{name:'สีเดิม',exact:true}).click();await save(page);
 await page.goto('/home');await expect(page.locator('.app-shell')).toHaveAttribute('data-home-canvas','false');
});
