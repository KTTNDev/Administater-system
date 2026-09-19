import {test,expect} from '@playwright/test';
test('backup manager is reachable from settings',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'ตั้งค่าหน่วยงานและ Drive',exact:true}).click();
 const panel=page.getByRole('region',{name:'กู้คืนชุดสำรอง'});
 await expect(panel).toBeVisible();await panel.getByRole('button',{name:'โหลดรายการชุดสำรอง'}).click();
 await expect(panel.getByText(/ยังไม่มีชุดสำรอง/).or(panel.getByRole('table'))).toBeVisible();
});
