import {test,expect} from '@playwright/test';
test('searches work intent, opens a destination and supports keyboard and empty state',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/อยากทำอะไร/}).click();
 const dialog=page.getByRole('dialog'),input=page.getByRole('textbox',{name:'ค้นหาเมนูด้วยสิ่งที่ต้องการทำ'});
 await input.fill('โอนงบซื้อคอม');await dialog.getByRole('button',{name:/โอนงบประมาณ/}).click();await expect(page.getByRole('heading',{name:'โอนงบประมาณ',exact:true})).toBeVisible();
 await page.keyboard.press('Control+k');await input.fill('ซื้อพิซซ่า');await expect(dialog).toContainText('ยังไม่พบงานที่ตรง');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await page.keyboard.press('Control+k');await input.fill('บันทึกข้อความ');await input.press('Enter');await expect(page.getByRole('heading',{name:'จัดทำร่างหนังสือใหม่'})).toBeVisible();
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill('ร่างที่ยังไม่บันทึก');await page.keyboard.press('Control+k');await input.fill('กฎหมาย');page.once('dialog',d=>d.dismiss());await input.press('Enter');await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue('ร่างที่ยังไม่บันทึก');
});
test('search dialog fits a mobile screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:/อยากทำอะไร/}).click();await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
