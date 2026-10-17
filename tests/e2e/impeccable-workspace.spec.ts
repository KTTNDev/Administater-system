import {test,expect} from '@playwright/test';

test('all quick-create actions remain reachable on narrow screens',async({page})=>{
 await page.goto('/');
 const quick=page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'});
 for(const width of [320,375,414,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const name of ['หนังสือภายนอก','หนังสือภายใน','คำสั่ง','ประกาศ']){
   const action=quick.getByRole('button',{name,exact:true});await expect(action).toBeVisible();
   const box=await action.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  }
  await page.screenshot({path:`output/impeccable-home-${width}.png`});
 }
 await quick.getByRole('button',{name:'ประกาศ',exact:true}).click();
 await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toBeVisible();
 await expect(page.locator('.editor-title')).toContainText('ประกาศ');
});
