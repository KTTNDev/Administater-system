import {test,expect} from '@playwright/test';
test('all document forms offer both entry modes with the right ordered sections',async({page})=>{
 await page.goto('/?view=templates');
 const choices=page.locator('.template-choice');
 const total=await choices.count();
 expect(total).toBeGreaterThanOrEqual(13);
 for(let index=0;index<total;index++){
  await page.goto('/?view=templates');
  await page.locator('.template-choice').nth(index).click();
  const pane=page.locator('.form-pane');
  await page.getByRole('button',{name:'กรอกทีละส่วน',exact:true}).click();
  await expect(pane).toHaveAttribute('data-form-mode','steps');
  await expect(page.locator('#form-header')).toBeVisible();
  await expect(page.locator('#form-body')).toBeHidden();
  const links=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button');
  const ids=await links.evaluateAll(items=>items.map(button=>button.getAttribute('aria-label')));
  for(let step=1;step<ids.length;step++){
   await page.locator('.form-step-controls').getByRole('button',{name:'ถัดไป',exact:true}).click();
   await expect(page.locator('.form-step-controls')).toContainText('ส่วนที่ '+(step+1)+'/'+ids.length);
   const visible=await pane.locator('[id^="form-"]').evaluateAll(items=>items.filter(item=>item.getClientRects().length).map(item=>item.id));
   expect(visible).toHaveLength(1);
  }
  await expect(page.locator('#form-review')).toBeVisible();
  await expect(page.locator('.form-step-controls').getByRole('button',{name:'ถัดไป',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'แสดงทุกส่วน',exact:true}).click();
  await expect(page.locator('#form-body')).toBeVisible();
  await expect(page.locator('#form-header')).toBeVisible();
 }
});
test('switching steps and modes retains input, live preview, and the chosen mode on the next document',async({page})=>{
 await page.goto('/?view=templates');
 await page.locator('.template-feature').first().click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
 await page.getByRole('button',{name:'กรอกทีละส่วน',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'});
 await nav.getByRole('button',{name:'เนื้อหา',exact:true}).click();
 await page.locator('#document-body').fill('เนื้อหาต้องคงอยู่เมื่อเปลี่ยนส่วน');
 const paper=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(paper.locator('.body-text').filter({hasText:'เนื้อหาต้องคงอยู่'})).toBeVisible();
 await page.locator('.form-step-controls').getByRole('button',{name:'ถัดไป',exact:true}).click();
 await expect(page.locator('#form-signing')).toBeVisible();
 await page.locator('.form-step-controls').getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect(page.locator('#document-body')).toHaveValue('เนื้อหาต้องคงอยู่เมื่อเปลี่ยนส่วน');
 await page.getByRole('button',{name:'แสดงทุกส่วน',exact:true}).click();
 await expect(page.locator('#document-body')).toHaveValue('เนื้อหาต้องคงอยู่เมื่อเปลี่ยนส่วน');
 await page.getByRole('button',{name:'กรอกทีละส่วน',exact:true}).click();
 await page.screenshot({path:'output/guided-form-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('.form-step-controls')).toBeVisible();
 await page.screenshot({path:'output/guided-form-mobile.png'});
 await page.goto('/?view=templates');
 await page.locator('.template-feature').nth(1).click();
 await expect(page.locator('.form-pane')).toHaveAttribute('data-form-mode','steps');
 await expect(page.locator('#form-header')).toBeVisible();
 await expect(page.locator('#form-body')).toBeHidden();
});
test('section navigation stays flush with the scroll boundary as a single surface',async({page})=>{
 await page.goto('/?view=templates');
 await page.locator('.template-feature').nth(1).click();
 const pane=page.locator('.form-pane');
 const navigation=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'});
 for(const {width,focus} of [{width:1440,focus:false},{width:1700,focus:false},{width:1700,focus:true},{width:390,focus:false}]){
  const focusButton=page.locator('.editor-view-controls button');
  const focused=await focusButton.getAttribute('aria-pressed')==='true';
  if(focused!==focus)await focusButton.click();
  await page.setViewportSize({width,height:1000});
  for(const mode of ['แสดงทุกส่วน','กรอกทีละส่วน']){
   await page.getByRole('button',{name:mode,exact:true}).click();
   await navigation.getByRole('button',{name:'เนื้อหา',exact:true}).click();
   await expect(page.locator('#document-body')).toBeVisible();
   // Wait for the existing smooth section jump to settle before manual scrolling.
   await page.waitForTimeout(1000);
   await pane.evaluate(element=>{
    if(/(auto|scroll)/.test(getComputedStyle(element).overflowY))element.scrollTop+=350;
    else window.scrollBy(0,element.querySelector('.form-navigation-sticky')!.getBoundingClientRect().top+100);
   });
   await expect.poll(()=>pane.evaluate(element=>{
    const wrapper=element.querySelector('.form-navigation-sticky')!.getBoundingClientRect();
    const edge=/(auto|scroll)/.test(getComputedStyle(element).overflowY)?element.getBoundingClientRect().top:0;
    return Math.abs(wrapper.top-edge);
   })).toBeLessThanOrEqual(1);
   const wrapper=page.locator('.form-navigation-sticky');
   const box=(await wrapper.boundingBox())!,nav=(await navigation.boundingBox())!;
   expect(Math.abs(nav.y-box.y)).toBeLessThanOrEqual(1);
   // The nav itself spans the pane, not just its outer background.
   const paneBox=(await pane.boundingBox())!;
   expect(Math.abs(nav.x-box.x)).toBeLessThanOrEqual(1);
   expect(Math.abs(nav.width-box.width)).toBeLessThanOrEqual(1);
   expect(Math.abs(nav.x-paneBox.x)).toBeLessThanOrEqual(1);
   expect(Math.abs(nav.width-await pane.evaluate(el=>el.clientWidth))).toBeLessThanOrEqual(1);
   if(mode==='กรอกทีละส่วน'){
    const steps=(await page.locator('.form-step-controls').boundingBox())!;
    expect(Math.abs(steps.y-(nav.y+nav.height))).toBeLessThanOrEqual(1);
    expect(Math.abs(steps.x-nav.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(steps.width-nav.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height-(nav.height+steps.height+1))).toBeLessThanOrEqual(1);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(width===1440&&mode==='กรอกทีละส่วน')await page.screenshot({path:'output/form-sticky-fixed-desktop.png'});
   if(width===390&&mode==='กรอกทีละส่วน')await page.screenshot({path:'output/form-sticky-fixed-mobile.png'});
  }
 }
});
