import {test,expect} from '@playwright/test';

test('all quick-create actions remain reachable on narrow screens',async({page})=>{
 await page.goto('/');
 const quick=page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'});
 for(const width of [320,375,414,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const name of ['หนังสือภายนอก','หนังสือภายใน','คำสั่ง','ประกาศ']){
   const action=quick.getByRole('button',{name,exact:true});await expect(action).toBeVisible();
   // Reach the control as a user would, then wait through resize/hydration layout changes.
   await expect.poll(async()=>{
    try{await action.scrollIntoViewIfNeeded();const box=await action.boundingBox();return !!box&&box.x>=0&&box.x+box.width<=width+1;}
    catch(error){if(error instanceof Error&&/not attached/.test(error.message))return false;throw error;}
   },{timeout:10000}).toBe(true);
  }
  await page.screenshot({path:`output/impeccable-home-${width}.png`});
 }
 await quick.getByRole('button',{name:'ประกาศ',exact:true}).click();
 await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toBeVisible();
 await expect(page.locator('.editor-title')).toContainText('ประกาศ');
});
