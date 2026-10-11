import {test,expect} from '@playwright/test';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated release fixture');
test('failed save keeps entered data, permits retry and disables duplicate submission',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 const subject='ตรวจการลองบันทึกใหม่ '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);await page.locator('#document-body').fill('ข้อความต้องไม่หายเมื่อเครือข่ายขัดข้อง');
 await expect(page.locator('.recovery-panel')).toContainText('บันทึกสำเนากู้คืนแล้ว',{timeout:15000});
 let release:()=>void=()=>{};let attempts=0;
 const gate=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/',async route=>{if(route.request().method()==='POST'&&route.request().headers()['next-action']){attempts++;if(attempts===1){await gate;await route.abort();return;}}await route.continue();});
 const save=page.getByRole('button',{name:'บันทึกร่าง',exact:true});await save.click();await expect(save).toBeDisabled();release();
 await expect(page.getByRole('alert').filter({hasText:'กรุณาลองบันทึกใหม่'})).toBeVisible();await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(subject);await expect(page.locator('#document-body')).toHaveValue('ข้อความต้องไม่หายเมื่อเครือข่ายขัดข้อง');
 await expect(save).toBeEnabled();await save.click();await expect(page.locator('.toast[role=status]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject+' ยังไม่บันทึก');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'กลับรายการ',exact:true}).click();await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(subject+' ยังไม่บันทึก');
});
