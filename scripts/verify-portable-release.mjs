import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {applyUpdate,rollback} from './update-desktop.mjs';

const source=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const clean=path.resolve(process.argv[2]),update=path.resolve(process.argv[3]);
if(JSON.parse(fs.readFileSync(path.join(clean,'package-info.json'),'utf8')).includesPersonalData)throw Error('Use a clean package only');
if(fs.existsSync(path.join(clean,'.env.local'))||fs.existsSync(path.join(clean,'data/sarabun.sqlite')))throw Error('Clean package contains private data');
const root=path.join(source,'output','portable-v1-'+Date.now());fs.cpSync(clean,root,{recursive:true});fs.writeFileSync(path.join(root,'SAFETY-TEST-ONLY'),'Disposable');
const current=JSON.parse(fs.readFileSync(path.join(source,'.desktop/current.json'),'utf8'));
const previous=fs.readdirSync(path.join(source,'.desktop/versions')).filter(x=>x!==current.version).sort((a,b)=>fs.statSync(path.join(source,'.desktop/versions',b)).mtimeMs-fs.statSync(path.join(source,'.desktop/versions',a)).mtimeMs)[0];
if(!previous)throw Error('Need a previous desktop build for an actual upgrade test');
fs.cpSync(path.join(source,'.desktop/versions',previous),path.join(root,'.desktop/versions',previous),{recursive:true});
fs.writeFileSync(path.join(root,'.desktop/current.json'),JSON.stringify({...current,version:previous,appVersion:'0.1.0'}));
function run(folder,cmd){const r=spawnSync(path.join(folder,'.desktop/runtime/node.exe'),[path.join(folder,'scripts/desktop.mjs'),cmd,'--no-browser'],{cwd:folder,windowsHide:true,encoding:'utf8',env:{...process.env,PATH:path.join(process.env.SystemRoot,'System32')}});if(r.status!==0)throw Error(r.stderr||r.stdout);console.log(r.stdout.trim());}
const fingerprint=()=>{const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'),{readOnly:true});try{return createHash('sha256').update(JSON.stringify(db.prepare('SELECT id,data,version FROM documents ORDER BY id').all())).digest('hex');}finally{db.close();}};
let browser;
try{
 run(source,'stop');run(root,'start');run(root,'start');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:3000/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 const subject='ทดสอบย้ายเครื่อง V1 '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);await page.locator('#document-body').fill('ตรวจข้อมูลก่อนและหลังอัปเดต');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.locator('.toast[role=status]').filter({hasText:'บันทึกร่างเรียบร้อยแล้ว'}).waitFor();
 const before=fingerprint();await browser.close();browser=null;
 const updated=applyUpdate(root,update);if(fingerprint()!==before)throw Error('Upgrade changed documents');
 const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'),{readOnly:true});const id=db.prepare('SELECT id FROM documents LIMIT 1').get().id;db.close();
 const response=await fetch('http://127.0.0.1:3000/api/documents/'+id+'/pdf');if(!response.ok)throw Error('Updated portable PDF failed');const pdf=await PDFDocument.load(await response.arrayBuffer());if(pdf.getPageCount()<1)throw Error('Empty portable PDF');
 const restored=rollback(root);if(fingerprint()!==before)throw Error('Rollback changed original documents');run(root,'stop');
 // A moved copy must resolve paths from its new directory, not the test installation.
 const moved=path.join(source,'output','portable-v1-moved-'+Date.now());fs.cpSync(clean,moved,{recursive:true});
 try{run(moved,'start');const health=await (await fetch('http://127.0.0.1:3000/api/health')).json();if(health.application!=='sarabun')throw Error('Moved launch failed');}finally{run(moved,'stop');}
 fs.writeFileSync(path.join(source,'output/v1-portable-check.json'),JSON.stringify({at:new Date().toISOString(),cleanHasNoPersonalData:true,startsWithNoNodeOnPath:true,doubleLaunchReusesServer:true,upgradePreservesDocuments:true,rollbackPreservesDocuments:true,movedFolderLaunch:true,pdfPages:pdf.getPageCount(),fixture:root,updatedBackup:updated.backup,rollbackRescue:restored.rescue},null,2));
 console.log('Portable, update, rollback and moved-folder acceptance passed.');
}finally{if(browser)await browser.close();try{run(root,'stop');}catch{}run(source,'start');}
