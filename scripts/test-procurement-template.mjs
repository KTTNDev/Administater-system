import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import JSZip from "jszip";
const origin="http://127.0.0.1:3107",root=path.resolve("output/procurement-lab/template-d07");
const originalLatest=await fs.readFile(path.join(root,"latest.json"),"utf8").catch(()=>null),testResults=new Set();
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(90000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/procurement/template");await page.getByRole("heading",{name:"เอกสารจากแม่แบบต้นฉบับ"}).waitFor();await page.getByRole("button",{name:"คืนข้อมูลต้นฉบับ"}).click();
  await page.locator(".d07-paper-scroll img").first().evaluate(img=>img.complete?Promise.resolve():new Promise(resolve=>img.onload=resolve));
  const waitImage=async()=>page.waitForFunction(()=>{const img=document.querySelector('.d07-paper-scroll img');return img?.complete&&img.naturalWidth>900;});
  const build=async()=>{const waiting=page.waitForResponse(r=>r.url()===origin+"/api/procurement-template"&&r.request().method()==="POST",{timeout:120000});await page.getByRole("button",{name:"สร้างตัวอย่างและบันทึก",exact:true}).click();const r=await waiting;const data=await r.json();if(!r.ok())throw Error(JSON.stringify(data));testResults.add(data.result.id);await page.getByRole("button",{name:"สร้างตัวอย่างและบันทึก",exact:true}).waitFor();await page.waitForFunction(id=>document.querySelector('.d07-paper-scroll img')?.getAttribute('src')?.includes(id),data.result.id);await waitImage();return data.result;};
  const unchanged=await build();assert.equal(unchanged.pages,1);assert.deepEqual(unchanged.changed,[]);
  const bytes=await(await page.request.get(origin+"/api/procurement-template/"+unchanged.id+"/docx")).body();const output=await JSZip.loadAsync(bytes),reference=await JSZip.loadAsync(await fs.readFile(path.join(root,"reference.docx")));
  assert.equal(await output.file("word/document.xml").async("string"),(await reference.file("word/document.xml").async("string")).replace(/w:val="FF0000"/g,'w:val="000000"'));
  const sourceHash=createHash("sha256").update(await fs.readFile('C:/Users/PR-StartUp/Desktop/ตัวอย่างไฟล์งาน/7.รายงานพิจารณาผล.docx')).digest("hex");assert.equal(sourceHash,unchanged.sourceHash);
  for(const [label,value] of Object.entries({"รายชื่อผู้ยื่นข้อเสนอ":"ร้านทดสอบต้นแบบ","เลขหนังสือ":"ภก 52906/123","ชื่อผู้เสนอ (รวมคำนำหน้า)":"นายทดสอบ รักษาแบบ","ชื่อผู้อำนวยการกอง (รวมคำนำหน้า)":"นางตัวอย่าง รูปแบบเดิม","ชื่อปลัด / ผู้ปฏิบัติราชการแทน (รวมคำนำหน้า)":"นายทดสอบ แบบเดิม","ชื่อผู้มีอำนาจ (รวมคำนำหน้า)":"นายตัวอย่าง ต้นฉบับ","ราคาที่ตกลง (บาท รวมภาษี 7%)":"2,140.00"}))await page.getByLabel(label,{exact:true}).fill(value);
  const edited=await build();assert.equal(edited.pages,1);assert.equal(edited.changed.length,7);await page.reload();assert.equal(await page.getByLabel("รายชื่อผู้ยื่นข้อเสนอ",{exact:true}).inputValue(),"ร้านทดสอบต้นแบบ");
  await page.getByRole("button",{name:"ต้นฉบับอ้างอิง",exact:true}).click();assert((await page.locator(".d07-paper-scroll img").first().getAttribute("src")).includes("reference"));
  await page.getByRole("button",{name:"ฉบับที่สร้างล่าสุด",exact:true}).click();assert((await page.locator(".d07-paper-scroll img").first().getAttribute("src")).includes(edited.id));await waitImage();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,"editor-tested.png")});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const rejected=await page.request.post(origin+"/api/procurement-template",{headers:{Origin:"https://untrusted.invalid"},data:{values:{}}});assert.equal(rejected.status(),400);assert.deepEqual(errors,[]);
  await page.setViewportSize({width:1600,height:1100});await page.getByRole("button",{name:"คืนข้อมูลต้นฉบับ"}).click();await build();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,"editor-baseline.png")});
  await fs.writeFile(path.join(root,"qa.json"),JSON.stringify({unchanged,edited,sourceHash,crossOriginRejected:true,browserErrors:errors},null,2));console.log(JSON.stringify({unchanged,edited,sourceHash},null,2));
}finally{await browser.close();if(originalLatest){const now=JSON.parse(await fs.readFile(path.join(root,"latest.json"),"utf8"));if(testResults.has(now.result?.id))await fs.writeFile(path.join(root,"latest.json"),originalLatest);}}
