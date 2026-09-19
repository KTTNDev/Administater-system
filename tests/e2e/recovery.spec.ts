import {test,expect} from '@playwright/test';

test('unsaved budget survives reload as a new recovery draft',async({page})=>{
 const title=`ทดสอบสำเนากู้คืนงบ ${Date.now()}`;
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/?view=budget');
 await page.getByRole('button',{name:'ลองแพตเทิร์นจากไฟล์ตัวอย่าง'}).click();
 await page.getByLabel('เรื่อง',{exact:true}).fill(title);
 await expect(page.locator('.recovery-panel')).toContainText('บันทึกสำเนากู้คืนแล้ว',{timeout:30000});
 await page.reload();
 await page.getByRole('button',{name:'เปิดสำเนากู้คืน',exact:true}).click();
 await page.getByRole('button',{name:new RegExp(title)}).click();
 await expect(page.getByLabel('เรื่อง',{exact:true})).toHaveValue(title);
 await expect(page.getByLabel('ตรวจผู้มีอำนาจและข้อระเบียบที่ใช้กับรายการนี้แล้ว')).not.toBeChecked();
});

test('unsaved correspondence survives reload as a new draft',async({page})=>{
 const title=`ทดสอบสำเนากู้คืนหนังสือ ${Date.now()}`;
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/');
 await page.getByRole('button',{name:'แบบหนังสือราชการ',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายนอก',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();
 await page.getByLabel('เรื่อง / ชื่อร่าง').fill(title);
 await expect(page.locator('.recovery-panel')).toContainText('บันทึกสำเนากู้คืนแล้ว',{timeout:30000});
 await page.reload();
 await page.getByRole('button',{name:'เปิดสำเนากู้คืน',exact:true}).click();
 await page.getByRole('button',{name:new RegExp(title)}).click();
 await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(title);
});
