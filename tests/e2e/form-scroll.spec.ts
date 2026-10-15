import {test,expect} from '@playwright/test';
import {templates} from '../../src/lib/templates';

for(const width of [1440,960,868,390])for(const template of templates){
 test(`${template.id}: wheel and shortcuts at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await page.getByRole('button',{name:'สร้างหนังสือ',exact:true}).click();
  await page.locator('.template-card').filter({has:page.getByRole('heading',{name:template.name,exact:true})}).click();
  const nav=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'});
  const form=page.locator('.form-pane');
  const preview=page.locator('.preview-pane');
  const formBox=await form.boundingBox();
  const previewBox=await preview.boundingBox();
  expect(formBox).not.toBeNull();expect(previewBox).not.toBeNull();
  if(width<=1000)expect(formBox!.y).toBeLessThan(previewBox!.y);
  // Wheel along the form gutter, avoiding scrollable textareas.
  await page.mouse.move(formBox!.x+8,Math.min(600,formBox!.y+300));
  await page.mouse.wheel(0,650);
  await expect.poll(()=>form.evaluate(e=>e.scrollTop+(document.scrollingElement?.scrollTop??0))).toBeGreaterThan(300);
  await expect.poll(()=>nav.evaluate(e=>e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  expect((await nav.boundingBox())!.y).toBeLessThan(300);
  // A visible shortcut must move the real scroll container, without locator auto-scroll helping it.
  await nav.getByRole('button',{name:'ส่วนท้าย',exact:true}).click();
  await expect.poll(()=>page.locator('#form-signing').evaluate(e=>e.contains(document.activeElement))).toBe(true);
  await expect.poll(()=>page.locator('#form-signing').evaluate(e=>e.getBoundingClientRect().top)).toBeLessThan(700);
  const navBottom=(await nav.boundingBox())!.y+(await nav.boundingBox())!.height;
  expect((await page.locator('#form-signing').boundingBox())!.y).toBeGreaterThanOrEqual(navBottom-2);
  if(template.id==='external')await page.screenshot({path:`output/scroll-fixed-${width}.png`});
  await nav.getByRole('button',{name:'ตรวจทาน',exact:true}).click();
  await expect.poll(()=>page.locator('#form-review').evaluate(e=>e.contains(document.activeElement))).toBe(true);
  await expect.poll(()=>page.locator('#form-review').evaluate(e=>e.getBoundingClientRect().top)).toBeLessThan(800);
  await nav.getByRole('button',{name:'ส่วนหัว',exact:true}).click();
  await expect.poll(()=>page.locator('#form-header').evaluate(e=>e.contains(document.activeElement))).toBe(true);
  await expect.poll(()=>page.locator('#form-header').evaluate(e=>e.getBoundingClientRect().top)).toBeLessThan(450);
  await page.mouse.move(formBox!.x+8,500);
  await page.mouse.wheel(0,100000);
  await expect.poll(()=>form.evaluate(e=>{
   const s=getComputedStyle(e).overflowY==='auto'?e:document.scrollingElement!;
   return s.scrollHeight-s.clientHeight-s.scrollTop;
  })).toBeLessThanOrEqual(5);
  await page.mouse.wheel(0,-100000);
  await expect.poll(()=>form.evaluate(e=>e.scrollTop+(document.scrollingElement?.scrollTop??0))).toBeLessThan(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
}

test('long preview can be scrolled to its last page without moving the desktop form',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือ',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายนอก',exact:true})}).click();
 await page.locator('#document-body').fill(Array.from({length:60},(_,i)=>`ย่อหน้าที่ ${i+1} ทดสอบการเลื่อนเอกสารหลายหน้าและการเข้าถึงข้อความส่วนท้าย`).join('\n'));
 await expect.poll(()=>page.frameLocator('iframe').locator('.page').count()).toBeGreaterThan(1);
 const paper=page.locator('.paper-scroll'),form=page.locator('.form-pane');
 const before=await form.evaluate(e=>e.scrollTop);
 const box=(await paper.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+100);
 await page.mouse.wheel(0,100000);
 await expect.poll(()=>paper.evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop)).toBeLessThan(3);
 expect(await form.evaluate(e=>e.scrollTop)).toBe(before);
 await page.screenshot({path:'output/scroll-preview-last-page.png'});
 await page.mouse.wheel(0,-100000);
 await expect.poll(()=>paper.evaluate(e=>e.scrollTop)).toBeLessThan(3);
});
