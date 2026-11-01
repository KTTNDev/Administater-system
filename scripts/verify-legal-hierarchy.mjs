// Exercise a production build using a separate database and separate PDF mirror folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-law-tree-'));
const database=path.join(temporary,'test.sqlite');
const setup=new DatabaseSync(database);
setup.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
setup.prepare('INSERT INTO settings VALUES(?,?)').run('storage:local',path.join(temporary,'files'));setup.close();
const version=JSON.parse(fs.readFileSync(path.join(root,'.desktop/current.json'),'utf8')).version;
const app=path.join(root,'.desktop/versions',version,'app');
const output=path.join(root,'output','legal-hierarchy');fs.mkdirSync(output,{recursive:true});
const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});
const url='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[path.join(app,'server.js')],{cwd:app,windowsHide:true,env:{...process.env,PORT:String(port),HOSTNAME:'127.0.0.1',APP_URL:url,DATABASE_PATH:database,SARABUN_SOURCE_DIR:root,SARABUN_REQUIRE_LOGIN:'false',SARABUN_DISABLE_AUTO_BACKUP:'true'},stdio:['ignore','pipe','pipe']});
let logs='',browser;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
try {
 let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Server exited: '+logs);try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Server did not start');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?view=laws');
 const dialog=page.locator('dialog[open]');
 async function save(title,year,{parent='',relation='related',file=false}={}) {
  await dialog.locator('[name=title]').fill(title);
  await dialog.locator('[name=year]').fill(year);
  await dialog.locator('[name=category]').fill('พัสดุและจัดซื้อจัดจ้าง');
  if(parent)await expect(dialog.locator('[name=parentId]')).toHaveValue(parent);
  if(parent)await dialog.locator('[name=relationship]').selectOption(relation);
  if(file){const pdf=await PDFDocument.create();pdf.addPage([300,400]);await dialog.locator('[name=file]').setInputFiles({name:'ประกาศตัวอย่าง.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});}
  await dialog.getByRole('button',{name:'บันทึกเข้าคลัง',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const heading=page.getByRole('heading',{name:title,exact:true});await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article[1]').getAttribute('data-law-id');
 }
 const node=id=>page.locator(`[data-law-id="${id}"]`);
 await page.getByRole('button',{name:'เพิ่มเอกสาร',exact:true}).click();
 const a=await save('ระเบียบพัสดุ (ข้อมูลทดสอบ)','2560');
 await node(a).getByRole('button',{name:'เพิ่มเอกสารต่อเนื่อง',exact:true}).first().click();
 const b=await save('ประกาศเพิ่มเติม (ข้อมูลทดสอบ)','2565',{parent:a,relation:'notice',file:true});
 await node(b).getByRole('button',{name:'เพิ่มเอกสารต่อเนื่อง',exact:true}).first().click();
 const c=await save('หนังสือซักซ้อม (ข้อมูลทดสอบ)','2569',{parent:b,relation:'guidance'});
 await expect(node(a).locator(`[data-law-id="${c}"]`)).toBeVisible();
 await node(a).screenshot({path:path.join(output,'three-levels.png')});
 await page.getByLabel('ค้นคลังกฎหมาย',{exact:true}).fill('ซักซ้อม');
 await expect(node(a)).toBeVisible();await expect(node(b)).toBeVisible();await expect(node(c)).toBeVisible();
 await page.getByLabel('ค้นคลังกฎหมาย',{exact:true}).fill('');
 for(const width of [320,375,414,768,1440]) {
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:path.join(output,`library-${width}.png`)});
 }
 // Parent selection excludes the record itself and every descendant.
 await node(a).getByRole('button',{name:'แก้ไข',exact:true}).first().click();
 const options=await dialog.locator('[name=parentId] option').evaluateAll(list=>list.map(o=>o.value));
 expect(options).not.toContain(a);expect(options).not.toContain(b);expect(options).not.toContain(c);
 for(const width of [320,375,414,768,1440]) {
  await page.setViewportSize({width,height:1000});
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'ปิดฟอร์ม',exact:true}).click();
 // Deleting a root with children must not orphan the tree.
 await node(a).locator('details').first().locator('summary').click();
 page.once('dialog',d=>d.accept());await node(a).getByRole('button',{name:'ลบจากคลัง',exact:true}).first().click();
 await expect(page.getByRole('status')).toContainText('ย้ายเอกสารลูก');await expect(node(a)).toBeVisible();
 await page.getByRole('button',{name:'เพิ่มเอกสาร',exact:true}).click();
 const d=await save('หมวดเอกสารต้นทางใหม่ (ข้อมูลทดสอบ)','2561');
 await node(b).getByRole('button',{name:'แก้ไข',exact:true}).first().click();
 await dialog.locator('[name=parentId]').selectOption(d);
 await dialog.getByRole('button',{name:'บันทึกเข้าคลัง',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(node(d).locator(`[data-law-id="${b}"]`)).toBeVisible();
 await expect(node(d).locator(`[data-law-id="${c}"]`)).toBeVisible();
 await expect(node(a).locator(`[data-law-id="${b}"]`)).toHaveCount(0);
 await page.reload();
 await node(d).getByRole('button',{name:'เอกสารต่อเนื่อง 2 ฉบับ',exact:true}).click();
 await node(b).getByRole('button',{name:'เอกสารต่อเนื่อง 1 ฉบับ',exact:true}).click();
 await expect(node(c)).toBeVisible();
 const pdf=await page.request.get(url+`/api/legal/${b}`);expect(pdf.ok()).toBe(true);expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
 await node(c).getByRole('button',{name:'อ่าน / ดูโน้ต',exact:true}).click();
 await expect(page.getByRole('region',{name:'อ่านเอกสารและโน้ต',exact:true})).toBeFocused();
 expect(await page.getByRole('region',{name:'อ่านเอกสารและโน้ต',exact:true}).evaluate(el=>el.getBoundingClientRect().top<innerHeight)).toBe(true);
 await expect(page.getByLabel('เอกสารต้นทาง')).toContainText('หมวดเอกสารต้นทางใหม่');
 await page.getByRole('button',{name:'ปิดพื้นที่อ่าน',exact:true}).click();
 await expect(node(c).getByRole('button',{name:'อ่าน / ดูโน้ต',exact:true})).toBeFocused();
 await node(a).locator('details').first().locator('summary').click();
 page.once('dialog',e=>e.accept());await node(a).getByRole('button',{name:'ลบจากคลัง',exact:true}).first().click();
 await expect(node(a)).toHaveCount(0);await expect(node(b)).toBeVisible();
 expect(errors).toEqual([]);
 const check=new DatabaseSync(database,{readOnly:true});const rows=check.prepare('SELECT id,data FROM legal_library').all();check.close();
 expect(JSON.parse(rows.find(x=>x.id===b).data).parentId).toBe(d);expect(JSON.parse(rows.find(x=>x.id===c).data).parentId).toBe(b);
 console.log(JSON.stringify({result:'passed',levels:3,widths:[320,375,414,768,1440],searchContext:true,moveSubtree:true,parentDeletionBlocked:true,pdfPreserved:true,reload:true,errors,output}));
}catch(error){await browser?.contexts()[0]?.pages()[0]?.screenshot({path:path.join(output,'failure.png')});console.error(error);console.error(logs.slice(-1500));process.exitCode=1;}
finally {await browser?.close();child.kill();}
