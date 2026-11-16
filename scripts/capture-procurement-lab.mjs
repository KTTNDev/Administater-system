import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1550,height:1100}});await page.goto("http://127.0.0.1:3107/procurement/lab");
  await page.frameLocator('iframe[title="ตัวอย่างเอกสาร A4"]').locator('#pages[data-ready="true"]').waitFor();
  await page.locator(".lab-preview-toolbar small").filter({hasText:/^\d+ หน้า/}).waitFor();
  const radio=await page.getByRole("radio").first().boundingBox();assert(radio.width<=20&&radio.height<=20);
  const selected=await page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"}).inputValue();assert.equal(new URL(page.url()).searchParams.get("id"),selected);
  const documents=await(await page.request.get("http://127.0.0.1:3107/api/procurement-lab")).json();const other=documents.documents.find(d=>d.id!==selected);
  if(other){await page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"}).selectOption(other.id);await page.waitForURL("**/procurement/lab?id="+other.id);await page.reload();assert.equal(await page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"}).inputValue(),other.id);await page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"}).selectOption(selected);await page.waitForURL("**/procurement/lab?id="+selected);}
  await page.frameLocator('iframe[title="ตัวอย่างเอกสาร A4"]').locator('#pages[data-ready="true"]').waitFor();
  await page.screenshot({path:"output/procurement-stage-a/workspace.png"});
  await page.setViewportSize({width:768,height:1024});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  console.log("Preview reports page count; radio sizing and 768/390 px layouts passed");
}finally{await browser.close();}
