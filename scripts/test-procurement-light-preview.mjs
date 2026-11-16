import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const base='http://127.0.0.1:3108',folder='output/procurement-correspondence';
assert.equal(fs.readFileSync('output/procurement-main-demo/SAFETY-TEST-ONLY','utf8').trim(),'SARABUN_PROCUREMENT_MAIN_DEMO_V1');
const casesBefore=(await(await fetch(base+'/api/procurement')).json()).cases.length;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1750,height:1080}});page.setDefaultTimeout(180000);let requests=0;const errors=[];
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/procurement/live')requests++;});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('sarabun.procurement.preview-mode','manual'));
 await page.goto(base+'/?view=procurement');await page.getByRole('button',{name:'จัดซื้อ เริ่มงานซื้อพัสดุหรือสินค้า'}).click();
 const automatic=page.getByLabel('อัปเดตตัวอย่างอัตโนมัติ',{exact:true});await automatic.waitFor();assert.equal(await automatic.isChecked(),false);
 const vendor=page.getByRole('textbox',{name:'รายชื่อผู้ยื่นข้อเสนอ',exact:true});await vendor.fill('ร้านจำลองทดสอบโหมดประหยัด');
 await page.waitForTimeout(1700);assert.equal(requests,0,'Manual mode rendered while typing');
 await page.getByRole('button',{name:'จัดตัวอย่างใหม่',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('aside[data-preview-current="true"]')?.getAttribute('data-preview-url'));assert.equal(requests,1);
 await page.locator('aside canvas[data-rendered=true]').first().waitFor();
 await vendor.fill('ร้านจำลองเปลี่ยนชื่อ');await page.waitForTimeout(1700);assert.equal(requests,1,'Manual mode did not pause');
 assert.equal(await page.locator('aside[data-live-code]').getAttribute('data-preview-current'),'false');assert(await page.getByRole('button',{name:'เปิด PDF เพื่อพิมพ์',exact:true}).isDisabled());
 await page.screenshot({path:folder+'/light-preview.png'});
 await automatic.check();await page.waitForFunction(()=>document.querySelector('aside[data-preview-current="true"]')?.getAttribute('data-preview-url'));assert.equal(requests,2);
 assert.deepEqual(errors,[]);assert.equal((await(await fetch(base+'/api/procurement')).json()).cases.length,casesBefore);
 fs.writeFileSync(folder+'/light-preview-verified.json',JSON.stringify({ok:true,noRenderWhileTyping:true,manualRefresh:true,automaticMode:true,stalePrintBlocked:true,noSavedCases:true,errors},null,2));console.log('Manual and automatic previews verified; no saved test case');
}finally{await browser.close();}
