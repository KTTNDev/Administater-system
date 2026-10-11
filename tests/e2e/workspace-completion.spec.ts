import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {newDraft} from '../../src/lib/document';
const root=process.env.SARABUN_E2E_DATA_ROOT;
test.skip(!root,'Requires a disposable data root; never run restore against the user workspace.');
function connection(){
 const target=path.resolve(root!);if(!target.endsWith(path.join('output','feature-check')))throw new Error('Use the isolated feature-check fixture only.');
 return new DatabaseSync(path.join(target,'data','sarabun.sqlite'));
}
test('local-only storage and complete backup activation preserve settings and create a safety backup',async({page})=>{
 await page.goto('/?view=settings');
 await page.locator('.settings-disclosure > summary').click();
 const storage=page.locator('section').filter({has:page.getByRole('heading',{name:'พื้นที่จัดเก็บและซิงก์',exact:true})}).first();
 await expect(storage).toContainText(path.join(root!,'data','sarabun.sqlite'));
 await storage.getByLabel('โฟลเดอร์เก็บสำเนา PDF และข้อมูลส่งออก').fill(path.join(root!,'output','storage'));
 await storage.getByLabel('โฟลเดอร์ Drive สำหรับหนังสือและคลังระเบียบ',{exact:true}).fill('');
 await storage.getByLabel('โฟลเดอร์ Drive ส่วนตัวสำหรับสำรองข้อมูลระบบ').fill('');
 await storage.getByRole('button',{name:'บันทึกตำแหน่ง',exact:true}).click();
 await expect(storage.getByRole('status').first()).toContainText('บันทึกตำแหน่งจัดเก็บแล้ว');
 const id=randomUUID(),at=new Date().toISOString(),draft={...newDraft(),subject:'ฉบับก่อนกู้คืน '+id};
 const db=connection();try{db.prepare('INSERT INTO documents(id,data,version,created_at,updated_at) VALUES(?,?,1,?,?)').run(id,JSON.stringify(draft),at,at);}finally{db.close();}
 await storage.getByRole('button',{name:'ส่งออกข้อมูลทั้งหมดในเครื่อง'}).click();
 await expect(storage.getByRole('status').first()).toContainText('ส่งออก ',{timeout:30000});
 const edited=connection();try{edited.prepare('UPDATE documents SET data=?,version=version+1 WHERE id=?').run(JSON.stringify({...draft,subject:'แก้หลังสำรอง'}),id);}finally{edited.close();}
 const manager=page.getByRole('region',{name:'กู้คืนชุดสำรอง',exact:true});
 await manager.getByRole('button',{name:'โหลดรายการชุดสำรอง'}).click();
 await manager.getByRole('button',{name:'ตรวจและกู้คืน',exact:true}).first().click();
 await expect(manager.getByRole('table',{name:'เปรียบเทียบข้อมูลก่อนกู้คืน'})).toBeVisible({timeout:30000});
 await expect(manager.getByRole('button',{name:'นำชุดสำรองกลับมาใช้งาน'})).toBeDisabled();
 await manager.getByLabel('พิมพ์ กู้คืนข้อมูล เพื่อยืนยัน').fill('กู้คืนข้อมูล');
 await manager.getByRole('button',{name:'นำชุดสำรองกลับมาใช้งาน'}).click();
 await expect(manager.getByRole('status')).toContainText('นำข้อมูลกลับมาใช้แล้ว',{timeout:30000});
 await expect(manager.getByRole('status')).toContainText('สำรองก่อนเปลี่ยนไว้ที่');
 const verified=connection();try{const row=verified.prepare('SELECT data,version FROM documents WHERE id=?').get(id)!;expect(JSON.parse(String(row.data)).subject).toBe(draft.subject);expect(Number(row.version)).toBeGreaterThan(2);expect(verified.prepare("SELECT value FROM settings WHERE key='storage:local'").get()?.value).toBe(path.join(root!,'output','storage'));}finally{verified.close();}
 await manager.getByRole('button',{name:'โหลดข้อมูลที่กู้คืนแล้ว'}).click();await expect(page.locator('.app-shell')).toBeVisible();
});
test('Google client import rejects malformed files and accepts a valid local configuration without contacting Google',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());let external=0;
 await page.route('https://**/*',route=>{external++;return route.abort();});
 await page.goto('/?view=settings');
 const panel=page.getByRole('region',{name:'ความพร้อมใช้งานจริง'});
 await panel.getByText('ตั้งค่า Google Drive',{exact:true}).click();
 await panel.getByLabel('ไฟล์ Google OAuth Client (.json)').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('invalid')});
 await expect(panel.getByRole('alert')).toContainText('อ่านไฟล์ JSON ไม่สำเร็จ');
 const client={web:{client_id:'test-only.apps.googleusercontent.com',client_secret:'isolated-test-secret',redirect_uris:['http://127.0.0.1:3100/api/google/callback']}};
 await panel.getByLabel('ไฟล์ Google OAuth Client (.json)').setInputFiles({name:'client.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(client))});
 await expect(panel.getByRole('status')).toContainText(/บันทึกแล้ว|อัปเดตการตั้งค่าแล้ว/);
 await expect(panel).toContainText('ตั้งค่า Google OAuth Client แล้ว');
 expect(await page.locator('body').innerText()).not.toContain(client.web.client_secret);expect(external).toBe(0);
 expect(fs.existsSync(path.join(root!,'.env.local'))).toBe(true);
});
