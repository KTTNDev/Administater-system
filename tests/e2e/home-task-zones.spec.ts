import {test,expect} from '@playwright/test';
import {bangkokDay} from '../../src/lib/workdesk';
test('Home groups real tasks in a bounded zone, retains the original shortcut layout and supports completion',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated data only');
 await page.goto('/home');
 const panel=page.getByRole('region',{name:'To-do list หน้าหลัก',exact:true});
 const prefix='งานโซนหน้าหลัก '+Date.now();
 await panel.getByLabel('ค้นหางาน',{exact:true}).fill(prefix);
 const quick=panel.getByLabel('เพิ่มงานด่วน',{exact:true});
 for(let index=0;index<12;index++){
  await quick.fill(prefix+' '+index);await quick.press('Enter');
  await expect(panel.locator('.wd-task')).toHaveCount(index+1);
 }
 const scroll=panel.getByRole('region',{name:'รายการ To-do แบ่งตามกำหนดส่ง'});
 expect(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 expect((await scroll.boundingBox())!.height).toBeLessThanOrEqual(460);
 const bounds=await scroll.boundingBox();
 await quick.fill(prefix+' อีกงาน');await quick.press('Enter');
 await expect(panel.locator('.wd-task')).toHaveCount(13);
 expect((await scroll.boundingBox())!.height).toBe(bounds!.height);
 const group=panel.locator('[data-task-group=undated]');
 await expect(group.locator('summary')).toContainText('13 งาน');
 await group.locator('summary').click();await expect(group.locator('.wd-task').first()).toBeHidden();
 await group.locator('summary').click();
 await group.getByRole('checkbox',{name:'ทำเสร็จ: '+prefix+' 0',exact:true}).click();
 await expect(panel.locator('.wd-task')).toHaveCount(12);
 await panel.getByLabel('มุมมองรายการงาน',{exact:true}).selectOption('done');
 await expect(panel.locator('[data-task-group=done]')).toContainText(prefix+' 0');
 await panel.getByLabel('มุมมองรายการงาน',{exact:true}).selectOption('open');
 for(const [suffix,due,groupId] of [[' เกินกำหนด','2020-01-01','late'],[' วันนี้',bangkokDay(),'today'],[' ภายหลัง','2035-01-01','later']]){
  await page.getByRole('button',{name:'เพิ่มงาน',exact:true}).first().click();
  const form=page.getByRole('dialog',{name:'เพิ่มงาน',exact:true});
  await form.getByLabel('ชื่องาน',{exact:true}).fill(prefix+suffix);
  await form.getByLabel('กำหนดเสร็จ',{exact:true}).fill(due);
  await form.getByRole('button',{name:'บันทึกงาน',exact:true}).click();
  await expect(form).not.toBeVisible();
  await expect(panel.locator('[data-task-group='+groupId+']')).toContainText(prefix+suffix);
 }
 const menus=page.getByRole('group',{name:'เลือกงานในระบบ',exact:true});
 await expect(menus).toBeVisible();
 expect((await menus.locator('[data-home-card]').first().boundingBox())!.height).toBeGreaterThanOrEqual(110);
 expect((await menus.boundingBox())!.y).toBeLessThan((await panel.boundingBox())!.y);
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'output/home-task-zones-desktop.png',fullPage:true});
 for(const width of [320,375,414,768]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect((await scroll.boundingBox())!.height).toBeLessThanOrEqual(460);
 }
 await page.screenshot({path:'output/home-task-zones-narrow.png',fullPage:true});
 await page.reload();
 await panel.getByLabel('ค้นหางาน',{exact:true}).fill(prefix);
 await expect(panel.locator('[data-task-group=late]')).toContainText(prefix+' เกินกำหนด');
});
