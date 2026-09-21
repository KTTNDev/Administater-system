import {test,expect} from '@playwright/test';
test('shows safe setup status and actionable instructions',async({page})=>{
 await page.goto('/?view=settings');const panel=page.getByRole('region',{name:'ความพร้อมใช้งานจริง'});await expect(panel).toBeVisible();await expect(panel).toContainText('รหัสผ่านผู้ปฏิบัติงาน:');
 await panel.getByText('ตั้งรหัสผ่านและเปิดใช้งานจริง',{exact:true}).click();await expect(panel).toContainText('Setup-Sarabun-Production.cmd');
 await panel.getByText('สิ่งที่ต้องเตรียมสำหรับ Google Drive',{exact:true}).click();await expect(panel).toContainText('/api/google/callback');await panel.getByRole('button',{name:'ตรวจสถานะอีกครั้ง'}).click();await expect(panel.getByRole('button',{name:'ตรวจสถานะอีกครั้ง'})).toBeEnabled();
});
