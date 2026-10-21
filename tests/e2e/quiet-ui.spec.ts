import {test,expect} from '@playwright/test';

test('command search preserves focus, supports complete keyboard navigation and clears queries',async({page})=>{
 await page.goto('/');
 const original=page.getByLabel('ค้นหาเอกสารทุกข้อมูล');
 await original.fill('ข้อความค้นหาเดิม');await original.focus();
 await page.keyboard.press('Control+k');
 const dialog=page.getByRole('dialog',{name:'อยากทำอะไร?'}),input=page.getByLabel('ค้นหาเมนูด้วยสิ่งที่ต้องการทำ');
 await expect(input).toBeFocused();
 await input.fill('หนังสือ');const results=dialog.locator('[data-result]');
 await input.press('ArrowDown');await expect(results.first()).toBeFocused();
 await page.keyboard.press('End');await expect(results.last()).toBeFocused();
 await page.keyboard.press('Home');await expect(results.first()).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(input).toBeFocused();
 await dialog.getByRole('button',{name:'ล้างคำค้นเมนู'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();
 await expect(dialog.getByRole('region',{name:'เริ่มร่างจากทางลัด'})).toBeVisible();
 await page.keyboard.press('Control+k');await expect(dialog).toBeHidden();await expect(original).toBeFocused();
 await expect(original).toHaveValue('ข้อความค้นหาเดิม');
});

test('quick starts open both forms and command search does not take focus from an edit dialog',async({page})=>{
 await page.goto('/');
 for(const [label,form] of [['หนังสือภายนอก','หนังสือภายนอก'],['บันทึกข้อความ','หนังสือภายใน']]){
  await page.getByRole('button',{name:'อยากทำอะไร?',exact:true}).click();
  await page.getByRole('region',{name:'เริ่มร่างจากทางลัด'}).getByRole('button',{name:label,exact:true}).click();
  await expect(page.locator('.editor-title')).toContainText(form);
  await page.getByRole('button',{name:'กลับรายการ',exact:true}).click();
 }
 await page.getByRole('button',{name:'อยากทำอะไร?',exact:true}).click();
 await page.getByRole('region',{name:'เริ่มร่างจากทางลัด'}).getByRole('button',{name:'บันทึกข้อความ',exact:true}).click();
 await page.getByRole('button',{name:'จัดการรายชื่อหน่วยงาน',exact:true}).click();
 const manager=page.locator('dialog[open]');await expect(manager).toHaveCount(1);
 const focused=await page.evaluate(()=>document.activeElement?.outerHTML);
 await page.keyboard.press('Control+k');
 await expect(page.getByRole('dialog',{name:'อยากทำอะไร?'})).toBeHidden();
 expect(await page.evaluate(()=>document.activeElement?.outerHTML)).toBe(focused);
 await page.keyboard.press('Escape');await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('IME confirmation does not open a result until composition ends',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'อยากทำอะไร?',exact:true})).toBeEnabled();await page.keyboard.press('Control+k');
 const input=page.getByLabel('ค้นหาเมนูด้วยสิ่งที่ต้องการทำ'),dialog=page.getByRole('dialog',{name:'อยากทำอะไร?'});
 await input.fill('บันทึกข้อความ');
 await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
 await expect(dialog).toBeVisible();
 await input.press('Enter');await expect(page.locator('.editor-title')).toContainText('หนังสือภายใน');
});

for(const width of [320,375,414,768,1440])test('search and chrome stay usable at '+width+'px',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:800});await page.goto('/');
 await page.screenshot({path:'output/quiet-home-'+width+'.png'});
 await page.getByRole('button',{name:'อยากทำอะไร?',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'อยากทำอะไร?'});
 await expect(dialog).toBeInViewport();
 const box=(await dialog.boundingBox())!;
 expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await expect(dialog.getByRole('button',{name:'ปิดค้นหางาน'})).toBeInViewport();
 await expect(dialog.getByRole('region',{name:'เริ่มร่างจากทางลัด'})).toBeInViewport();
 for(const description of await dialog.locator('[data-result] small').all()){
  expect(await description.evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('normal');
  expect(await description.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 }
 await page.screenshot({path:'output/quiet-search-'+width+'.png'});
 const input=page.getByLabel('ค้นหาเมนูด้วยสิ่งที่ต้องการทำ');
 await input.fill('ซื้อพิซซ่า');await expect(dialog).toContainText('ยังไม่พบงานที่ตรง');
 await page.screenshot({path:'output/quiet-empty-'+width+'.png'});
 await dialog.getByRole('button',{name:'ดูทางลัดเริ่มต้น'}).click();
 await expect(input).toHaveValue('');await expect(input).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 expect(errors).toEqual([]);
});

test('a short viewport keeps the input and close button visible while scrolling results',async({page})=>{
 await page.setViewportSize({width:375,height:450});await page.goto('/');await expect(page.getByRole('button',{name:'อยากทำอะไร?',exact:true})).toBeEnabled();await page.keyboard.press('Control+k');
 const dialog=page.getByRole('dialog',{name:'อยากทำอะไร?'}),input=page.getByLabel('ค้นหาเมนูด้วยสิ่งที่ต้องการทำ');
 await input.fill('หนังสือ');
 await dialog.evaluate(async e=>{await Promise.all(e.getAnimations().map(animation=>animation.finished));});
 const before=(await input.boundingBox())!;
 await input.press('ArrowUp');await expect(dialog.locator('[data-result]').last()).toBeFocused();
 await expect(dialog.locator('[data-result]').last()).toBeInViewport();
 await expect(input).toBeInViewport();await expect(dialog.getByRole('button',{name:'ปิดค้นหางาน'})).toBeInViewport();
 expect((await input.boundingBox())!.y).toBeCloseTo(before.y,0);
 await page.screenshot({path:'output/quiet-search-short.png'});
});

test('reduced motion and high contrast keep navigation readable without glass',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await page.goto('/');await expect(page.getByRole('button',{name:'อยากทำอะไร?',exact:true})).toBeEnabled();await page.keyboard.press('Control+k');
 const dialog=page.getByRole('dialog',{name:'อยากทำอะไร?'});
 expect(await dialog.evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 expect(await dialog.evaluate(e=>getComputedStyle(e,'::backdrop').backdropFilter)).toBe('none');
 expect(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).backdropFilter)).toBe('none');
 await page.getByLabel('ค้นหาเมนูด้วยสิ่งที่ต้องการทำ').press('ArrowDown');
 await expect(dialog.locator('[data-result]').first()).toBeFocused();
 expect(await dialog.locator('[data-result]').first().evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth))).toBeGreaterThan(0);
 await page.screenshot({path:'output/quiet-high-contrast.png'});
});
