import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import {randomUUID} from 'node:crypto';import {PDFDocument} from 'pdf-lib';import JSZip from 'jszip';
import {inventorySchemas,emptyInventoryItem,type InventorySnapshot,type Movement} from '../../src/lib/inventory';
import {seedInventoryForm} from '../../src/lib/inventory-forms';
import {inventoryFormHtml} from '../../src/lib/inventory-form-render';
import {inventoryAnalysisHtml} from '../../src/lib/inventory-analysis-export';
import {inventoryAnalytics} from '../../src/lib/inventory-analytics';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Disposable installation only');
const supply={...emptyInventoryItem(),id:randomUUID(),code:'FORM-S1',name:'กระดาษสำหรับทดสอบแบบฟอร์ม',unit:'รีม',category:'วัสดุสำนักงาน',location:'ห้องพัสดุ',version:1,balance:16,updatedAt:'2026-10-01'};
const asset={...supply,id:randomUUID(),code:'FORM-A1',name:'กล้องบันทึกภาพสำหรับทดสอบ',kind:'asset' as const,unit:'เครื่อง',balance:1};
const move=(kind:Movement['kind'],i=supply,quantity=20):Movement=>({id:randomUUID(),number:'TEST-'+kind+'-'+i.code,version:2,kind,date:'2026-10-01',actor:'เจ้าหน้าที่ทดสอบ',requester:'ผู้เบิกทดสอบ',department:'สำนักปลัด',purpose:'ใช้ประกอบการปฏิบัติงาน',reference:'เอกสารทดสอบ 1',approver:'ผู้อนุมัติทดสอบ',approvalPosition:'หัวหน้าสำนักปลัด',due:'',place:'inside',status:'posted',createdAt:'2026-10-01T01:00:00Z',lines:[{itemId:i.id,code:i.code,name:i.name,kind:i.kind,unit:i.unit,quantity,unitCost:100}]});
const receipt=move('receive'),issue=move('issue',supply,4),assetReceipt=move('receive',asset,1),fixture:InventorySnapshot={items:[supply,asset],movements:[receipt,issue,assetReceipt],files:[]};
const assets={regular:'data:font/ttf;base64,'+fs.readFileSync('public/fonts/THSarabunNew.ttf').toString('base64'),bold:'data:font/ttf;base64,'+fs.readFileSync('public/fonts/THSarabunNew-Bold.ttf').toString('base64'),garuda:'data:image/png;base64,'+fs.readFileSync('public/assets/garuda.png').toString('base64')};
test('all reference forms render complete pages and printable reports',async({page})=>{
 test.setTimeout(150000);
 for(let i=1;i<=8;i++){
  const d=seedInventoryForm(fixture,{templateId:i,asOf:'2026-10-23',sourceId:i===1?supply.id:i===4?issue.id:asset.id,organization:'เทศบาลทดสอบ',department:'สำนักปลัด'});
  if(i===5)d.rows[0].unitCost='100';
  const html=inventoryFormHtml(d,false,assets);await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone?:boolean}).__paginationDone));expect(await page.evaluate(()=>Boolean((window as unknown as {__overflow?:boolean}).__overflow))).toBe(false);const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});fs.writeFileSync('output/inventory-template-'+i+'.pdf',pdf);fs.writeFileSync('output/inventory-template-'+i+'.html',html);
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeLessThanOrEqual(2);
  await page.locator('.page').first().screenshot({path:'output/inventory-template-'+i+'.png'});
 }
 const a=inventoryAnalytics(fixture,'2026-10-01','2027-09-30','2026-10-23');await page.setContent(inventoryAnalysisHtml(a,'เทศบาลทดสอบ',assets));await page.evaluate(()=>document.fonts.ready);const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});fs.writeFileSync('output/inventory-analysis.pdf',pdf);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(3);await page.screenshot({path:'output/inventory-analysis-print.png',fullPage:true});
});
test('creates, previews, edits, reopens and exports every template; responsive report dashboard',async({page,request})=>{
 test.setTimeout(240000);
 const root=process.env.SARABUN_E2E_DATA_ROOT!;expect(fs.existsSync(path.join(root,'SAFETY-TEST-ONLY'))).toBe(true);
 const conn=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));for(const [table,sql] of Object.entries(inventorySchemas))conn.exec('CREATE TABLE IF NOT EXISTS '+table+' ('+sql+')');
 for(const i of fixture.items)conn.prepare('INSERT INTO inventory_items VALUES(?,?,?,?,?,?)').run(i.id,i.code,JSON.stringify(i),i.version,i.balance,i.updatedAt);
 for(const m of fixture.movements)conn.prepare('INSERT INTO inventory_movements VALUES(?,?,?,?)').run(m.id,m.number,JSON.stringify(m),m.version);conn.close();
 await page.goto('/?view=inventory');const app=page.getByRole('region',{name:'คลังพัสดุและครุภัณฑ์'});
 await app.getByRole('button',{name:'แบบฟอร์มและผลตรวจ',exact:true}).click();
 for(let i=1;i<=8;i++){
  const details=app.locator('details').filter({has:page.getByText('สร้างเอกสารจากแบบฟอร์ม',{exact:true})});await details.evaluate(el=>el.setAttribute('open',''));
  await app.getByRole('combobox',{name:'แบบฟอร์ม',exact:true}).selectOption(String(i));await app.getByLabel('ข้อมูลถึงวันที่',{exact:true}).fill('2026-10-23');
  if(i<=4)await app.getByRole('combobox',{name:'เชื่อมรายการ',exact:true}).selectOption(i===1?supply.id:i===4?issue.id:asset.id);
  await app.getByRole('button',{name:'สร้างร่าง',exact:true}).click();await expect(app.getByLabel('ชื่อร่าง',{exact:true})).toBeVisible();
  await app.getByLabel('ชื่อร่าง',{exact:true}).fill('ตรวจแบบฟอร์ม '+i);
  await app.getByLabel('ข้อความท้ายเอกสาร',{exact:true}).fill('ทดสอบการแก้ไขแบบ '+i);
  const preview=page.frameLocator('iframe[title="ตัวอย่างแบบฟอร์มพัสดุ"]');await expect(preview.locator('#pages')).toContainText('ทดสอบการแก้ไขแบบ '+i);
  if(i===5){
   await app.getByLabel('ราคาต่อหน่วย (รวมภาษี)',{exact:true}).fill('-1');
   await app.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(app.getByRole('alert')).toContainText('ตั้งแต่ศูนย์');
   await app.getByLabel('ราคาต่อหน่วย (รวมภาษี)',{exact:true}).fill('120');
   await expect(preview.locator('#pages')).toContainText('1,920.00');
   await app.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
   await app.getByLabel('รายการวัสดุ',{exact:true}).last().fill('รายการเพิ่มทดสอบ');
   await app.getByRole('button',{name:'เลื่อนรายการ 2 ขึ้น',exact:true}).click();
   await expect(preview.locator('#pages tbody tr').first()).toContainText('รายการเพิ่มทดสอบ');
   await app.getByRole('button',{name:'เลื่อนรายการ 1 ลง',exact:true}).click();
   page.once('dialog',dialog=>dialog.accept());await app.getByRole('button',{name:'ลบรายการ 2',exact:true}).click();
   await expect(preview.locator('#pages tbody tr')).toHaveCount(1);
  }
  await app.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(app.getByRole('status')).toContainText('บันทึกร่างแล้ว');
  const pdf=await request.get(await app.getByRole('link',{name:'PDF',exact:true}).getAttribute('href')||'');expect(pdf.ok()).toBe(true);expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBeLessThanOrEqual(2);
  const office=await request.get(await app.getByRole('link',{name:'Word',exact:true}).getAttribute('href')||'');expect(office.ok()).toBe(true);const bytes=await office.body();fs.writeFileSync('output/inventory-template-'+i+'.docx',bytes);const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('ทดสอบการแก้ไขแบบ '+i);expect(xml).toContain('TH Sarabun New');expect(xml).toContain('th-TH');if(i<8)expect(xml).toContain('<w:tbl>');
 }
 const check=new DatabaseSync(path.join(root,'data/sarabun.sqlite'),{readOnly:true});expect(check.prepare('SELECT balance FROM inventory_items WHERE id=?').get(supply.id)?.balance).toBe(16);check.close();
 await page.reload();await app.getByRole('button',{name:'แบบฟอร์มและผลตรวจ',exact:true}).click();await app.getByRole('button',{name:/ตรวจแบบฟอร์ม 8/}).click();await expect(app.getByLabel('ชื่อร่าง',{exact:true})).toHaveValue('ตรวจแบบฟอร์ม 8');
 await expect(app.getByRole('textbox',{name:'ข้อความท้ายเอกสาร',exact:true})).toHaveValue('ทดสอบการแก้ไขแบบ 8');
 for(const width of [375,1440]){await page.setViewportSize({width,height:1000});await expect(page.frameLocator('iframe[title="ตัวอย่างแบบฟอร์มพัสดุ"]').locator('#pages')).toContainText('ทดสอบการแก้ไขแบบ 8');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'output/inventory-form-ui-'+width+'.png',fullPage:true});}
 await app.getByRole('button',{name:'วิเคราะห์พัสดุ',exact:true}).click();
 await expect(app.getByRole('heading',{name:'ภาพรวมพัสดุ',exact:true})).toBeVisible();
 for(const width of [320,375,414,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'output/inventory-report-ui-'+width+'.png',fullPage:true});}
 const pdf=await request.get(await app.getByRole('link',{name:'รายงาน PDF',exact:true}).getAttribute('href')||'');expect(pdf.ok()).toBe(true);
 await page.goto('/?view=reports');await page.getByRole('button',{name:'วิเคราะห์พัสดุและครุภัณฑ์',exact:true}).click();await expect(page.getByRole('heading',{name:'ภาพรวมพัสดุ',exact:true})).toBeVisible();
});


test('long inventory table repeats headings, keeps all rows and does not overflow paper',async({page})=>{
 const d=seedInventoryForm(fixture,{templateId:5,asOf:'2026-10-23',sourceId:'',organization:'เทศบาลทดสอบ',department:'สำนักปลัด'});
 d.rows=Array.from({length:100},(_,i)=>({description:'รายการทดสอบ '+(i+1)+' สำหรับตรวจการแบ่งหน้า',quantity:'2',unit:'ชุด',unitCost:'25'}));
 await page.setContent(inventoryFormHtml(d,false,assets));await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone?:boolean}).__paginationDone));
 expect(await page.evaluate(()=>Boolean((window as unknown as {__overflow?:boolean}).__overflow))).toBe(false);
 const count=await page.locator('#pages .page').count();expect(count).toBeGreaterThan(2);
 await expect(page.locator('#pages tbody tr')).toHaveCount(100);
 await expect(page.locator('#pages')).toContainText('รายการทดสอบ 100');
 expect(await page.locator('#pages thead').count()).toBeGreaterThan(2);
 const pdf=await page.pdf({preferCSSPageSize:true});expect((await PDFDocument.load(pdf)).getPageCount()).toBe(count);
 fs.writeFileSync('output/inventory-long-table.pdf',pdf);
});
