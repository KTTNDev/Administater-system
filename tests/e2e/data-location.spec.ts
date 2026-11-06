import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const root=process.env.SARABUN_E2E_DATA_ROOT;
test.skip(!root,'Requires disposable installation');
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function rows(file:string,sql:string){const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}}
test('organizes real exports and signed scan, then moves and continues editing on the new database',async({page})=>{
 test.setTimeout(180000);if(!fs.existsSync(path.join(root!,'SAFETY-TEST-ONLY')))throw Error('Unsafe fixture');
 const subject='ทดสอบแฟ้มตามเรื่อง '+Date.now(),local=path.join(root!,'output','storage'),oldDb=path.join(root!,'data','sarabun.sqlite'),target=path.join(root!,'พื้นที่ใหม่'),nextDb=path.join(target,'ฐานข้อมูล','sarabun.sqlite');
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const doc=rows(oldDb,'SELECT id,data FROM documents').find(r=>JSON.parse(String(r.data)).subject===subject)!;expect(doc).toBeTruthy();
 for(const [format,extension] of [['PDF','.pdf'],['Word','.docx']]){
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด '+format,exact:true}).click();const saved=await download;const bytes=fs.readFileSync((await saved.path())!);
  const index=JSON.parse(fs.readFileSync(path.join(local,'.sarabun-file-index.json'),'utf8')),folder=path.join(local,index.folders['document:'+doc.id],'เอกสาร');
  const copy=fs.readdirSync(folder).find(n=>n.endsWith(extension));expect(copy).toBeTruthy();expect(digest(fs.readFileSync(path.join(folder,copy!)))).toBe(digest(bytes));
 }
 await page.goto('/');await page.getByRole('button',{name:'ไฟล์สแกนฉบับลงนามของ '+subject,exact:true}).click();const scans=page.getByRole('dialog',{name:'ไฟล์สแกนฉบับลงนาม'});await scans.getByRole('checkbox').check();const scan=fs.readFileSync('public/assets/garuda.png');await scans.locator('input[type=file]').setInputFiles({name:'ฉบับลงนาม.png',mimeType:'image/png',buffer:scan});await expect(scans.locator('.signed-scan-row')).toHaveCount(1);await scans.getByRole('button',{name:'ปิด',exact:true}).click();
 const index=JSON.parse(fs.readFileSync(path.join(local,'.sarabun-file-index.json'),'utf8')),folder=path.join(local,index.folders['document:'+doc.id]),manifest=JSON.parse(fs.readFileSync(path.join(folder,'รายการไฟล์.json'),'utf8'));const signed=manifest.files.find((r:{kind:string})=>r.kind==='signed');expect(digest(fs.readFileSync(path.join(folder,signed.path)))).toBe(digest(scan));
 await page.goto('/?view=settings');await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();const storage=page.getByRole('region',{name:'จัดแฟ้มและย้ายที่เก็บข้อมูล'});
 await storage.getByRole('button',{name:'จัดแฟ้มงานเดิม / ตรวจไฟล์อีกครั้ง'}).click();await expect(storage.getByRole('status')).toContainText('จัดแฟ้มสำเร็จ');
 await storage.getByText('เปลี่ยนโฟลเดอร์ข้อมูลทั้งชุด',{exact:true}).click();await storage.getByLabel('โฟลเดอร์ข้อมูลใหม่',{exact:false}).fill(local);await storage.getByRole('button',{name:'ตรวจสอบก่อนย้าย'}).click();await expect(storage.getByRole('status')).toContainText('ไม่ซ้อนกัน');
 await storage.getByLabel('โฟลเดอร์ข้อมูลใหม่',{exact:false}).fill(target);await storage.getByRole('button',{name:'ตรวจสอบก่อนย้าย'}).click();await expect(storage.getByText('ปลายทางพร้อมรับข้อมูล',{exact:true})).toBeVisible();await expect(storage.getByRole('button',{name:'ย้ายข้อมูลไปโฟลเดอร์นี้',exact:true})).toBeDisabled();await storage.getByRole('checkbox',{name:'ตรวจตำแหน่งแล้ว และพร้อมย้ายข้อมูลทั้งชุด'}).check();await storage.getByRole('button',{name:'ย้ายข้อมูลไปโฟลเดอร์นี้',exact:true}).click();await expect(storage.getByRole('status')).toContainText('ย้ายข้อมูลสำเร็จ',{timeout:60000});
 expect(fs.existsSync(nextDb)).toBe(true);expect(rows(nextDb,'SELECT id FROM documents').map(r=>r.id)).toEqual(rows(oldDb,'SELECT id FROM documents').map(r=>r.id));expect(rows(oldDb,"SELECT value FROM settings WHERE key='storage:relocatedTo'")[0].value).toBe(nextDb);
 const movedIndex=JSON.parse(fs.readFileSync(path.join(target,'.sarabun-file-index.json'),'utf8'));expect(digest(fs.readFileSync(path.join(target,movedIndex.folders['document:'+doc.id],signed.path)))).toBe(digest(scan));
 await page.reload();await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();await expect(storage).toContainText(nextDb);await page.goto('/');await page.getByRole('button',{name:'ทำต่อ: '+subject,exact:true}).click();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject+' แก้ไขหลังย้าย');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');expect(JSON.parse(String(rows(nextDb,"SELECT data FROM documents WHERE id='"+doc.id+"'")[0].data)).subject).toBe(subject+' แก้ไขหลังย้าย');expect(JSON.parse(String(rows(oldDb,"SELECT data FROM documents WHERE id='"+doc.id+"'")[0].data)).subject).toBe(subject);
 await page.goto('/?view=settings');await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();await storage.getByText('รูปแบบการจัดแฟ้ม',{exact:true}).click();await storage.screenshot({path:'output/local-dossiers-browser.png'});
});
