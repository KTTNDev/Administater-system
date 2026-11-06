import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {PDFDocument} from 'pdf-lib';import JSZip from 'jszip';
import {officeSchema} from '../../src/lib/office';
import {projectFilesSql} from '../../src/lib/project';
import {inventorySchemas,emptyInventoryItem} from '../../src/lib/inventory';
import {inventoryFormSchema,inventoryFormSql} from '../../src/lib/inventory-forms';
import {buildDossierSyncPlan} from '../../scripts/dossier-sync-plan.mjs';
import {reportOutputState} from '../../scripts/report-files.mjs';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated installation only');
test('archives every report export, leaves previews alone and carries identical bytes into the Drive plan',async({page,request})=>{
 test.setTimeout(180000);
 const root=process.env.SARABUN_E2E_DATA_ROOT!,storage=path.join(root,'output/storage');expect(fs.existsSync(path.join(root,'SAFETY-TEST-ONLY'))).toBe(true);
 const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));const projectId=randomUUID(),movementId=randomUUID(),formId=randomUUID();
 try{
  db.exec('CREATE TABLE IF NOT EXISTS office_items(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)');for(const [table,sql] of Object.entries(inventorySchemas))db.exec('CREATE TABLE IF NOT EXISTS '+table+' ('+sql+')');db.exec('CREATE TABLE IF NOT EXISTS inventory_form_drafts('+inventoryFormSql+')');
  const project=officeSchema.parse({kind:'project',title:'โครงการทดสอบการเก็บรูปเล่ม',fiscalYear:2570,owner:'เจ้าหน้าที่ทดสอบ',date:'2026-11-01',due:'2026-11-30',projectProfile:{department:'กองสวัสดิการสังคม',rationale:'ตรวจแฟ้มรูปเล่ม PDF และ Word'}});
  db.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run(projectId,JSON.stringify(project),'2026-11-01T00:00:00Z');
  db.exec('CREATE TABLE IF NOT EXISTS project_files('+projectFilesSql+')');const appendix=await PDFDocument.create();appendix.addPage([300,400]).drawText('PROJECT APPENDIX');db.prepare('INSERT INTO project_files VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),projectId,'','planning','หลักฐานทดสอบ.pdf','application/pdf',Buffer.from(await appendix.save()),'หลักฐานสำหรับตรวจรูปเล่ม',1,'2026-11-01T00:00:00Z');
  const item={...emptyInventoryItem(),id:randomUUID(),code:'ARCHIVE-'+Date.now(),name:'กระดาษทดสอบแฟ้ม',unit:'รีม',kind:'supply',version:1,balance:10};
  db.prepare('INSERT INTO inventory_items VALUES(?,?,?,?,?,?)').run(item.id,item.code,JSON.stringify(item),1,10,'2026-11-01T00:00:00Z');
  const movement={id:movementId,number:'ARCHIVE-'+Date.now(),version:1,kind:'issue',date:'2026-11-01',actor:'ผู้จ่ายทดสอบ',requester:'ผู้เบิกทดสอบ',department:'กองทดสอบ',purpose:'ทดสอบจัดแฟ้ม',reference:'',approver:'ผู้อนุมัติ',approvalPosition:'หัวหน้ากอง',due:'',place:'inside',status:'posted',createdAt:'2026-11-01T00:00:00Z',lines:[{itemId:item.id,code:item.code,name:item.name,kind:'supply',unit:'รีม',quantity:1,unitCost:100}]};
  db.prepare('INSERT INTO inventory_movements VALUES(?,?,?,1)').run(movementId,movement.number,JSON.stringify(movement));
  const form=inventoryFormSchema.parse({templateId:5,title:'แบบฟอร์มทดสอบแฟ้ม',asOf:'2026-11-01',sourceId:'',organization:'เทศบาลทดสอบ',department:'กองทดสอบ',fields:{},rows:[{description:'กระดาษ',quantity:'1',unit:'รีม',unitCost:'100'}],signers:[],notes:'',footer:''});
  db.prepare('INSERT INTO inventory_form_drafts VALUES(?,?,1,?)').run(formId,JSON.stringify(form),'2026-11-01T00:00:00Z');
  const versions=()=>JSON.stringify([db.prepare('SELECT data,version FROM office_items WHERE id=?').get(projectId),db.prepare('SELECT data,version FROM inventory_form_drafts WHERE id=?').get(formId),db.prepare('SELECT data,version FROM inventory_movements WHERE id=?').get(movementId),db.prepare('SELECT balance FROM inventory_items WHERE id=?').get(item.id)]),before=versions();
  const preview=await request.get('/api/projects/'+projectId+'/report?format=pdf');expect(preview.status(),await preview.text().then(t=>t.slice(0,200))).toBe(200);expect(reportOutputState(db,storage,'project',projectId)).toBeNull();const previewPages=(await PDFDocument.load(await preview.body())).getPageCount();
  const formPreview=await request.get('/api/inventory/forms?id='+formId+'&format=preview');expect(formPreview.ok()).toBe(true);expect(reportOutputState(db,storage,'inventory-form',formId)).toBeNull();
  const requests=[
   {url:'/api/projects/'+projectId+'/report?format=pdf&download=1',kind:'project',id:projectId,format:'pdf'},
   {url:'/api/projects/'+projectId+'/report?format=word',kind:'project',id:projectId,format:'docx'},
   {url:'/api/inventory/forms?id='+formId+'&format=pdf',kind:'inventory-form',id:formId,format:'pdf'},
   {url:'/api/inventory/forms?id='+formId+'&format=office',kind:'inventory-form',id:formId,format:'docx'},
   {url:'/api/inventory/export?mode=form&id='+movementId,kind:'inventory',id:movementId,format:'pdf'},
   {url:'/api/inventory/export?mode=report&start=2026-10-01&end=2026-11-01&q=ARCHIVE',kind:'report',format:'pdf'},
   {url:'/api/inventory/export?mode=csv&start=2026-10-01&end=2026-11-01&q=ARCHIVE',kind:'report',format:'csv'},
   {url:'/api/inventory/analysis?format=pdf&start=2026-10-01&end=2026-11-01&note=ทดสอบ',kind:'report',format:'pdf'},
   {url:'/api/inventory/analysis?format=csv&start=2026-10-01&end=2026-11-01&note=ทดสอบ',kind:'report',format:'csv'}
  ];
  const downloaded=[];
  for(const task of requests){const response=await request.get(task.url);expect(response.status(),response.headers()['content-type']==='application/json'?await response.text():task.url).toBe(200);const bytes=await response.body();if(task.format==='pdf'){const count=(await PDFDocument.load(bytes)).getPageCount();expect(count).toBeGreaterThan(0);if(task.kind==='project')expect(count).toBe(previewPages);}if(task.format==='docx')expect((await JSZip.loadAsync(bytes)).file('word/document.xml')).not.toBeNull();const plan=buildDossierSyncPlan(db,storage),entry=plan.entries.find(e=>e.ownerKind===task.kind&&(!task.id||e.ownerId===task.id)&&e.name.endsWith('.'+task.format)&&fs.readFileSync(path.join(storage,e.relativePath)).equals(bytes));expect(entry,task.url).toBeTruthy();downloaded.push({url:task.url,file:entry!.relativePath,bytes:bytes.length});}
  expect(versions()).toBe(before);
  // A disk problem must be reported, without marking a nonexistent copy saved.
  const bad=path.join(root,'not-a-directory');fs.writeFileSync(bad,'existing file');db.prepare("INSERT OR REPLACE INTO settings VALUES('storage:local',?)").run(bad);const failure=await request.get('/api/inventory/forms?id='+formId+'&format=office');expect(failure.status()).toBe(400);expect(fs.readFileSync(bad,'utf8')).toBe('existing file');db.prepare("DELETE FROM settings WHERE key='storage:local'").run();
  const retry=await request.get('/api/inventory/forms?id='+formId+'&format=office');expect(retry.ok()).toBe(true);expect(versions()).toBe(before);
  await page.goto('/?view=settings');await page.getByRole('tab',{name:'ที่เก็บและสำรองข้อมูล',exact:true}).click();await page.getByText('รูปแบบการจัดแฟ้ม',{exact:true}).click();await expect(page.getByRole('region',{name:'จัดแฟ้มและย้ายที่เก็บข้อมูล'})).toContainText('รายงานตามช่วงเวลา');await page.screenshot({path:'output/report-archive-settings.png'});
  fs.writeFileSync('output/report-archive-browser-verification.json',JSON.stringify({exports:downloaded,businessDataUnchanged:true,previewCreatesNoOutput:true,diskErrorAndRetryPassed:true},null,2));
 }finally{db.close();}
});
