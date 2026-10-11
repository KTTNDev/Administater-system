import {test,expect} from '@playwright/test';
test('shows desktop instructions and safe Google setup status',async({page})=>{
 await page.goto('/?view=settings');const panel=page.getByRole('region',{name:'ความพร้อมใช้งานจริง'});await expect(panel).toBeVisible();await expect(panel).toContainText('เปิดใช้งานได้ทันที ไม่ต้องล็อกอิน');
 await panel.getByText('วิธีเปิดใช้งานประจำ',{exact:true}).click();await expect(panel).toContainText('Open-Sarabun.cmd');
 await panel.getByText('ตั้งค่า Google Drive',{exact:true}).click();await expect(panel).toContainText('/api/google/callback');await expect(panel.getByLabel('ไฟล์ Google OAuth Client (.json)')).toBeVisible();await panel.getByRole('button',{name:'ตรวจสถานะอีกครั้ง'}).click();await expect(panel.getByRole('button',{name:'ตรวจสถานะอีกครั้ง'})).toBeEnabled();
});
