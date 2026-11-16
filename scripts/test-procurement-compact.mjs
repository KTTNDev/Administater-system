import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:3108',qa=path.resolve('output/procurement-suite/qa');
assert.equal(fs.readFileSync('output/procurement-main-demo/SAFETY-TEST-ONLY','utf8').trim(),'SARABUN_PROCUREMENT_MAIN_DEMO_V1');
const before=await (await fetch(base+'/api/procurement')).json();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1750,height:1080}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?view=procurement');await page.getByRole('button',{name:'จัดซื้อ เริ่มงานซื้อพัสดุหรือสินค้า'}).click();
 const vendor=page.getByRole('textbox',{name:'รายชื่อผู้ยื่นข้อเสนอ',exact:true});await vendor.waitFor();assert.equal(await vendor.inputValue(),'');assert.match(await vendor.getAttribute('placeholder'),/^ตัวอย่าง:/);
 await page.getByText('ข้อความสีจางที่ขึ้นต้น',{exact:false}).waitFor();
 assert.equal(await vendor.evaluate(el=>getComputedStyle(el).fontSize),'13px');
 const visibleInputs=await page.locator('main input:visible, main select:visible, main textarea:visible').count();assert(visibleInputs<10,'too many initial inputs: '+visibleInputs);
 await vendor.fill('ร้านสาธิต ทดสอบข้อมูล');
 for(const [i,description,quantity,unit,price] of [[1,'กระดาษถ่ายเอกสาร A4','2','รีม','500.00'],[2,'แฟ้มเก็บเอกสาร','3','แฟ้ม','122.00']]){
  await page.getByRole('button',{name:'+ เพิ่มรายการ',exact:true}).click();
  for(const name of ['สินค้า','จำนวน','หน่วย','ราคาต่อหน่วย'])assert.equal(await page.getByRole('textbox',{name:name+' '+i,exact:true}).inputValue(),'');
  for(const [name,value] of [['สินค้า',description],['จำนวน',quantity],['หน่วย',unit],['ราคาต่อหน่วย',price]])await page.getByRole('textbox',{name:name+' '+i,exact:true}).fill(value);
 }
 await page.getByText('สุทธิ 1,366.00 บาท',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('aside[data-preview-current=true]')?.getAttribute('data-preview-url'));await page.locator('aside canvas[data-rendered=true]').first().waitFor();
 await page.screenshot({path:path.join(qa,'compact-editor.png')});
 await page.locator('summary').filter({hasText:'งบประมาณและประเภทพัสดุ'}).click();
 const number=page.getByRole('textbox',{name:'วงเงินงบประมาณตั้งไว้ (บาท)',exact:true}),words=page.getByRole('textbox',{name:'วงเงินงบประมาณตั้งไว้ (ตัวอักษร)',exact:true});
 await number.fill('30,000.25');await page.waitForFunction(()=>document.querySelector('input[name=allocatedBudgetWords]')?.value==='สามหมื่นบาทยี่สิบห้าสตางค์');assert(await words.evaluate(el=>el.readOnly));await words.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,'compact-budget-auto.png')});
 await number.fill('');assert.equal(await words.inputValue(),'');await number.fill('30000');assert.equal(await words.inputValue(),'สามหมื่นบาทถ้วน');
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์มจัดซื้อจัดจ้าง'}).getByRole('button',{name:'ส่วนหัว',exact:true}).click();await page.getByLabel('เลขหนังสือ D07',{exact:true}).fill('ทดสอบ/07');
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์มจัดซื้อจัดจ้าง'}).getByRole('button',{name:'งานและรายการ',exact:true}).click();assert.equal(await number.inputValue(),'30000');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(qa,'compact-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'mobile overflow');assert.deepEqual(errors,[]);
 const after=await (await fetch(base+'/api/procurement')).json();assert.equal(after.cases.length,before.cases.length);assert.equal(after.files.length,before.files.length);
 fs.writeFileSync(path.join(qa,'compact-report.json'),JSON.stringify({ok:true,visibleInputs,inputFont:'13px',automaticBudgetWords:true,emptyPlaceholders:true,unsaved:true,errors},null,2));console.log(JSON.stringify({ok:true,visibleInputs,automaticBudgetWords:true}));
}finally{await browser.close();}
