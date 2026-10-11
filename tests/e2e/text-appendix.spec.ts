import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
const image=(name:string)=>`data:image/png;base64,${fs.readFileSync('public/'+name).toString('base64')}`;
const assets={regular:`data:font/ttf;base64,${fs.readFileSync('public/fonts/THSarabunNew.ttf').toString('base64')}`,bold:`data:font/ttf;base64,${fs.readFileSync('public/fonts/THSarabunNew-Bold.ttf').toString('base64')}`,garuda:image('assets/garuda.png'),routingStamp:image('assets/approval-routing-stamp.png'),copyMark:image('assets/copy-counterpart.png')};

test('text appendix begins on a fresh A4 sheet and renders bold text and a table',async({page})=>{
 const draft={...newDraft('internal'),subject:'ตัวอย่างบันทึกพร้อมแนบท้าย',body:'ข้อความหนังสือ',appendixPages:[
  {id:'00000000-0000-4000-8000-000000000001',title:'รายละเอียดประกอบ',body:'รายการ **สำคัญ**\n| หัวข้อ | จำนวน |\n| --- | --- |\n| อุปกรณ์ | 2 |'},
  {id:'00000000-0000-4000-8000-000000000002',title:'รายละเอียดหน้า 2',body:'ข้อความเพิ่มเติม'}
 ]};
 await page.setContent(documentHtml(draft,assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const sheets=page.locator('.page');expect(await sheets.count()).toBeGreaterThanOrEqual(3);
 await expect(sheets.nth(0).locator('.appendix-page-start')).toHaveCount(0);
 await expect(sheets.nth(1).locator('.appendix-page-start')).toHaveText('รายละเอียดประกอบ');
 await expect(sheets.nth(1).locator('.appendix-text strong')).toHaveText('สำคัญ');
 await expect(sheets.nth(1).locator('.document-table')).toContainText('อุปกรณ์');
 await expect(sheets.nth(2).locator('.appendix-page-start')).toHaveText('รายละเอียดหน้า 2');
});

test('an internal memo can author two appendix sheets, save, reopen, and export them',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Use disposable data only.');
 page.on('dialog',dialog=>dialog.accept());
 const subject='ทดสอบหน้าแนบท้าย '+Date.now();
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();await page.getByLabel("เลขที่หนังสือ",{exact:true}).fill("");await page.getByLabel('เรื่อง / ชื่อร่าง').fill(subject);
 if(!(await page.getByRole('button',{name:'เพิ่มเอกสารแนบท้ายอีกฉบับ'}).isVisible()))await page.locator('summary').filter({hasText:'เอกสารแนบท้ายที่สร้างในระบบ'}).click();
 await page.getByRole('button',{name:'เพิ่มเอกสารแนบท้ายอีกฉบับ'}).click();
 const first=page.getByRole('region',{name:'เอกสารแนบท้ายฉบับที่ 1'});
 await first.getByLabel('หัวเรื่องเอกสารแนบท้ายฉบับที่ 1').fill('รายการประกอบการพิจารณา');
 await first.getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 1').fill('ข้อความสำคัญ');
 await first.getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 1').evaluate((element:HTMLTextAreaElement)=>element.setSelectionRange(0,element.value.length));
 await first.getByRole('button',{name:'ตัวหนา'}).click();
 await first.getByRole('button',{name:'แทรกตาราง'}).click();
 await expect(first.getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 1')).toHaveValue(/\*\*ข้อความสำคัญ\*\*/);
 await expect(first.getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 1')).toHaveValue(/\| หัวข้อ \| รายละเอียด \|/);
 if(!(await page.getByRole('button',{name:'เพิ่มเอกสารแนบท้ายอีกฉบับ'}).isVisible()))await page.locator('summary').filter({hasText:'เอกสารแนบท้ายที่สร้างในระบบ'}).click();
 await page.getByRole('button',{name:'เพิ่มเอกสารแนบท้ายอีกฉบับ'}).click();
 const second=page.getByRole('region',{name:'เอกสารแนบท้ายฉบับที่ 2'});
 await second.getByLabel('หัวเรื่องเอกสารแนบท้ายฉบับที่ 2').fill('ข้อมูลเพิ่มเติม');
 await second.getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 2').fill('เนื้อหาของหน้าที่สอง');
 const frame=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(frame.locator('.appendix-page-start')).toHaveCount(2);
 await expect(frame.locator('.appendix-page-start').first()).toHaveText('รายการประกอบการพิจารณา');
 const saveButton=page.getByRole('button',{name:'บันทึกร่าง',exact:true});
 await saveButton.scrollIntoViewIfNeeded();
 await saveButton.click();
 await expect(page.locator('.toast[role=status]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 await page.reload();await page.getByLabel('ค้นหาเอกสารทุกข้อมูล').fill(subject);
 await page.getByRole('button',{name:new RegExp('^'+subject)}).first().click();
 await expect(page.getByRole('region',{name:'เอกสารแนบท้ายฉบับที่ 2'}).getByLabel('เนื้อหาเอกสารแนบท้ายฉบับที่ 2')).toHaveValue('เนื้อหาของหน้าที่สอง');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();
 const file=await download;const location=await file.path();const pdf=await PDFDocument.load(fs.readFileSync(location!));expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
});


test('a long appendix table continues on later sheets with the heading row repeated',async({page})=>{
 const lines=Array.from({length:80},(_,index)=>`| รายการ ${index+1} | รายละเอียด ${index+1} |`).join('\n');
 const draft={...newDraft('memorandum'),body:'เนื้อหาบันทึก',appendixPages:[{id:'00000000-0000-4000-8000-000000000003',title:'บัญชีรายละเอียด',body:`| ลำดับ | รายละเอียด |\n| --- | --- |\n${lines}`}]};
 await page.setContent(documentHtml(draft,assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const tables=page.locator('.page .document-table');expect(await tables.count()).toBeGreaterThan(1);
 expect(await page.locator('.page .document-table tbody tr').count()).toBe(80);
 for(const table of await tables.all())await expect(table.locator('thead')).toHaveText('ลำดับรายละเอียด');
});




test('bold text remains bold when one appendix paragraph flows onto another sheet',async({page})=>{

 const repeated=Array.from({length:260},(_,index)=>`**คำสำคัญ${index}**`).join(' ');
 const draft={...newDraft('internal'),body:'บันทึกตัวอย่าง',appendixPages:[{id:'00000000-0000-4000-8000-000000000004',title:'ย่อหน้าต่อเนื่อง',body:repeated}]};
 await page.setContent(documentHtml(draft,assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 expect(await page.locator('.page').count()).toBeGreaterThan(2);
 expect(await page.locator('.page .appendix-text strong').count()).toBe(260);
 await expect(page.locator('.page').last()).toContainText('คำสำคัญ259');
});








test('structured internal memo sections also support bold text and tables',async({page})=>{
 await page.goto('/');
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();await page.getByLabel("เลขที่หนังสือ",{exact:true}).fill("");
 await page.getByLabel('แยกเนื้อหาตามหน้าที่ของย่อหน้า').check();
 const subject=page.getByLabel('เรื่องเดิม',{exact:true});
 await subject.fill('ข้อเท็จจริงสำคัญ');
 await subject.evaluate((element:HTMLTextAreaElement)=>element.setSelectionRange(0,element.value.length));
 const section=page.locator('.body-section-input').filter({has:subject});
 await section.getByRole('button',{name:'ตัวหนา'}).click();
 await section.getByRole('button',{name:'แทรกตาราง'}).click();
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(preview.locator('.body-text strong')).toHaveText('ข้อเท็จจริงสำคัญ');
 await expect(preview.locator('.document-table')).toContainText('หัวข้อ');
});
