import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
const root=process.env.SARABUN_E2E_DATA_ROOT;
test.skip(!root,'Disposable installation only');
test('Drive dossier controls explain connection and handle configuration errors without claiming success',async({page})=>{
 if(!fs.existsSync(path.join(root!,'SAFETY-TEST-ONLY')))throw Error('Unsafe fixture');
 await page.goto('/?view=settings');await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();const panel=page.getByRole('region',{name:'ซิงก์แฟ้มงานรายเรื่องขึ้น Drive'});await panel.scrollIntoViewIfNeeded();await expect(panel.getByRole('button',{name:'เตรียมรายการจากแฟ้มในเครื่อง'})).toBeDisabled();await expect(panel).toContainText('เชื่อมบัญชี');
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();await page.getByLabel('เรื่อง / ชื่อร่าง').fill('ทดสอบคิวแฟ้ม Drive');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const conn=new DatabaseSync(path.join(root!,'data','sarabun.sqlite'));
 try{
  const set=conn.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');set.run('google:token','fixture-no-real-token');set.run('google:account','fixture-account');set.run('storage:driveRoot','fixture-drive-root-123');
  await page.goto('/?view=settings');await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();await panel.getByRole('button',{name:'เตรียมรายการจากแฟ้มในเครื่อง'}).click();await expect(panel.getByRole('status')).toContainText('ยังไม่ได้ส่งขึ้น Drive');await expect(panel.getByRole('progressbar')).toHaveAttribute('value','0');await expect(panel).toContainText('ทดสอบคิวแฟ้ม Drive');
  await panel.getByRole('button',{name:'เริ่มซิงก์แฟ้มงาน',exact:true}).click();await expect(panel.getByRole('status')).toContainText('ตั้งค่า Google OAuth');await expect(panel.getByRole('progressbar')).toHaveAttribute('value','0');expect(conn.prepare("SELECT value FROM settings WHERE key='drive:dossier:lease'").get()?.value).toBe('0');
  await page.reload();await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();await expect(panel).toContainText('ทดสอบคิวแฟ้ม Drive');await panel.getByLabel('ค้นหาเรื่องหรือชื่อไฟล์').fill('ไม่มีเรื่องนี้');await expect(panel.locator('details')).toHaveCount(0);await panel.getByLabel('ค้นหาเรื่องหรือชื่อไฟล์').fill('');await panel.screenshot({path:'output/dossier-sync-browser.png'});
 }finally{conn.prepare("DELETE FROM settings WHERE key IN ('google:token','google:account','storage:driveRoot','drive:dossier:job','drive:dossier:lease')").run();conn.close();}
});
