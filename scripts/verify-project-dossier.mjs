// Starts its own production server and SQLite database. Never writes demo records to port 3000.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import JSZip from 'jszip';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-project-ui-'));
const version=JSON.parse(fs.readFileSync(path.join(root,'.desktop/current.json'),'utf8')).version;
const app=path.join(root,'.desktop/versions',version,'app');
const output=path.join(root,'output','project-dossier');fs.mkdirSync(output,{recursive:true});
const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})});
const url='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[path.join(app,'server.js')],{cwd:app,windowsHide:true,env:{...process.env,PORT:String(port),HOSTNAME:'127.0.0.1',APP_URL:url,DATABASE_PATH:path.join(temporary,'test.sqlite'),SARABUN_SOURCE_DIR:root,SARABUN_REQUIRE_LOGIN:'false',SARABUN_DISABLE_AUTO_BACKUP:'true'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
let browser;
try{
 let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Test server exited: '+logs);try{const r=await fetch(url);if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}if(!ready)throw Error('Test server did not start');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p))});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/?view=projects');
 await page.getByRole('button',{name:'เพิ่มโครงการ',exact:true}).first().click();
 const dialog=page.locator('dialog[open]');
 await dialog.getByLabel('ชื่อโครงการ',{exact:true}).fill('โครงการตัวอย่าง ส่งเสริมคุณภาพชีวิตผู้สูงอายุ');
 await dialog.getByLabel('ผู้รับผิดชอบ',{exact:true}).fill('เจ้าหน้าที่ตัวอย่าง');
 await dialog.getByLabel('วันเริ่ม',{exact:true}).fill('2026-11-01');await dialog.getByLabel('กำหนดเสร็จ',{exact:true}).fill('2026-11-30');
 await dialog.getByLabel('งบประมาณตามที่กรอก (บาท)').fill('5000');
 await dialog.getByRole('button',{name:'บันทึกโครงการ',exact:true}).click();
 await expect(page.locator('.pd-root')).toBeVisible();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'เพิ่มรายการตรวจตั้งต้น',exact:true}).click();await expect(page.locator('.pd-task')).toHaveCount(1);
 await page.locator('.pd-task-name').first().click();
 const image=await sharp({create:{width:900,height:500,channels:3,background:'#c5d7d5'}}).png().toBuffer();
 const pdf=await PDFDocument.create();pdf.addPage([300,400]);
 await page.locator('.pd-upload input').setInputFiles([{name:'ภาพกิจกรรม.png',mimeType:'image/png',buffer:image},{name:'หนังสืออนุมัติ.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())}]);
 await expect(page.locator('.pd-file')).toHaveCount(2);
 const imageCard=page.locator('.pd-file').filter({has:page.locator('img')});
 await imageCard.getByLabel('คำอธิบาย',{exact:true}).fill('ภาพกิจกรรมตัวอย่างสำหรับตรวจรูปเล่ม');
 await imageCard.getByRole('button',{name:'บันทึกคำอธิบาย / การรวมเล่ม'}).click();await expect(imageCard.getByRole('button',{name:'บันทึกคำอธิบาย / การรวมเล่ม'})).toBeDisabled();
 await page.locator('.pd-task').getByRole('button',{name:'แก้ไข',exact:true}).click();
 await dialog.getByLabel('ผู้รับผิดชอบ',{exact:true}).fill('ฝ่ายแผนงาน');await dialog.getByLabel(/^สถานะ/).selectOption('done');await dialog.getByRole('button',{name:'บันทึกงาน',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.pd-task-name')).toContainText('ฝ่ายแผนงาน');
 await page.getByRole('button',{name:'เนื้อหารายงาน',exact:true}).click();
 await page.getByLabel('หน่วยงาน / กอง',{exact:true}).fill('กองสวัสดิการสังคม');
 const fields=['หลักการและเหตุผล','อำนาจหน้าที่และระเบียบที่ใช้','ความเชื่อมโยงแผนพัฒนา / แผนงาน','วัตถุประสงค์','กลุ่มเป้าหมายและจำนวน','สถานที่ดำเนินงาน'];
 for(const label of fields)await page.getByLabel(label,{exact:true}).fill(label==='หลักการและเหตุผล'?'ข้อมูลตัวอย่างเพื่อทดสอบระบบ ไม่ใช่โครงการจริง\n'+('ส่งเสริมการมีส่วนร่วมและคุณภาพชีวิตของผู้สูงอายุในชุมชน ').repeat(35):'ข้อมูลตัวอย่าง: '+label);
 await page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first().click();await expect(page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first()).toBeDisabled();
 await page.getByRole('navigation',{name:'ขั้นตอนโครงการ'}).getByRole('button').last().click();
 await page.getByLabel('ผลลัพธ์และประโยชน์ที่เกิดขึ้น',{exact:true}).fill('ผู้เข้าร่วมแลกเปลี่ยนประสบการณ์และทำกิจกรรมร่วมกัน');
 await page.getByRole('button',{name:'เพิ่มตัวชี้วัด',exact:true}).click();
 await page.getByLabel('ชื่อตัวชี้วัด',{exact:true}).fill('จำนวนผู้เข้าร่วม');await page.getByLabel('เป้าหมาย',{exact:true}).fill('30');await page.getByLabel('ผลจริง',{exact:true}).fill('28');await page.getByLabel('วิธีวัดผล',{exact:true}).fill('ทะเบียนลงชื่อ');
 await page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first().click();await expect(page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first()).toBeDisabled();
 // A dirty draft must survive a cancelled navigation.
 await page.getByRole('textbox',{name:'ข้อเสนอแนะและการติดตามต่อ',exact:true}).fill('ยังไม่บันทึก');await page.locator('.wd-project-list>button').first().click();page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await expect(page.getByRole('textbox',{name:'ข้อเสนอแนะและการติดตามต่อ',exact:true})).toHaveValue('ยังไม่บันทึก');
 await page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first().click();await expect(page.getByRole('button',{name:'บันทึกเนื้อหา',exact:true}).first()).toBeDisabled();
 await page.getByRole('button',{name:'ตรวจความครบถ้วน',exact:true}).click();await expect(page.locator('.pd-checklist')).toBeVisible();
 for(const width of [320,375,414,768,1440]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error('Page overflow at '+width);}
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'งานและหลักฐาน',exact:true}).click();await expect(page.locator('.pd-tabs')).toHaveCSS('flex-direction','row');await page.getByRole('navigation',{name:'ขั้นตอนโครงการ'}).getByRole('button').first().click();await page.locator('.pd-task-name').first().click();await page.locator('.pd-root').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'project-workspace.png')});
 await page.getByRole('button',{name:'ตัวอย่างรูปเล่ม',exact:true}).click();
 const src=await page.locator('.pd-preview').getAttribute('src');
 const response=await page.request.get(url+src,{timeout:90000});if(!response.ok())throw Error(await response.text());const pdfBytes=await response.body();fs.writeFileSync(path.join(output,'sample-project.pdf'),pdfBytes);const report=await PDFDocument.load(pdfBytes);if(report.getPageCount()<10)throw Error('Report chapters or appendix missing');
 const word=await page.request.get(url+src.replace('format=pdf','format=word'),{timeout:90000});if(!word.ok())throw Error(await word.text());const wordBytes=await word.body();fs.writeFileSync(path.join(output,'sample-project.docx'),wordBytes);const zip=await JSZip.loadAsync(wordBytes);const xml=await zip.file('word/document.xml').async('string');if(!xml.includes('thaiDistribute')||!xml.includes('จำนวนผู้เข้าร่วม')||!xml.includes('ฝ่ายแผนงาน'))throw Error('Word content missing');
 // Reload proves persistence; the parent record and children should survive a new request.
 await page.goto(url+'/?view=projects');await page.locator('.wd-project-list>button').first().click();await page.getByRole('button',{name:'เนื้อหารายงาน',exact:true}).click();await expect(page.getByLabel('หน่วยงาน / กอง',{exact:true})).toHaveValue('กองสวัสดิการสังคม');
 if(errors.length)throw Error(errors.join('\n'));
 const database=new DatabaseSync(path.join(temporary,'test.sqlite'),{readOnly:true});const fileCount=database.prepare('SELECT count(*) n FROM project_files').get().n;database.close();
 console.log(JSON.stringify({result:'passed',pages:report.getPageCount(),files:fileCount,responsiveWidths:[320,375,414,768,1440],output,database:'isolated temporary database',errors}));
}catch(e){await browser?.contexts()[0]?.pages()[0]?.screenshot({path:path.join(output,'failure.png')});console.error(e);console.error(logs.slice(-2500));process.exitCode=1;}finally{await browser?.close();child.kill();}
