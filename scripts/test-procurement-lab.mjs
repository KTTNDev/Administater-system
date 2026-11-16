import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import JSZip from "jszip";
const origin="http://127.0.0.1:3107",out=path.resolve("output/procurement-stage-a");await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const context=await browser.newContext({viewport:{width:1550,height:1100},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
context.setDefaultTimeout(60000);
const api=async(url,method="GET",data)=>{const r=await context.request.fetch(origin+"/api/procurement-lab"+url,{method,headers:{Origin:origin},data,timeout:90000});if(!r.ok())throw Error(await r.text());return r;};
const post=async(url,data)=>await(await api(url,"POST",data)).json();
const save=async(d)=>await(await api("/"+d.id,"PUT",{version:d.version,data:d.data})).json();
let finalId;const report={scenarios:[],checks:[]};
try{
  await page.goto(origin+"/procurement/lab");await page.getByRole("heading",{name:"พื้นที่ทดลองเอกสารจัดซื้อจัดจ้าง"}).waitFor();
  for(const scenario of ["short","long","longer"]){
    const {document:d}=await post("",{scenario});finalId=d.id;
    await page.reload();await page.evaluate(()=>window.scrollTo(0,0));const selection=page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"});await selection.selectOption(d.id);
    await page.waitForFunction(()=>document.querySelector('iframe[title="ตัวอย่างเอกสาร A4"]')?.contentWindow!==null);
    const frame=page.frameLocator('iframe[title="ตัวอย่างเอกสาร A4"]');await frame.locator('#pages[data-ready="true"]').waitFor();
    await page.waitForTimeout(800);
    const layout=await frame.locator("body").evaluate(body=>({pages:body.querySelectorAll(".page").length,footers:body.querySelectorAll(".continuation").length,signers:body.querySelectorAll(".signer").length,overflows:Array.from(body.querySelectorAll(".content")).filter(n=>n.scrollHeight>n.clientHeight+1).length,signaturePages:new Set(Array.from(body.querySelectorAll(".signer")).map(n=>n.closest(".page").dataset.page)).size}));
    console.log(scenario,JSON.stringify(layout));if(layout.overflows)console.log(await frame.locator("body").evaluate(()=>({ready:window.__procurementReady,error:window.__procurementError,overflow:window.__overflow,measurement:window.__signingMeasurement,finalSign:document.querySelector('.signing').getBoundingClientRect().toJSON(),content:Array.from(document.querySelectorAll(".content")).map(n=>({height:n.clientHeight,scroll:n.scrollHeight,text:n.textContent.slice(-100)}))})));assert.equal(layout.footers,layout.pages-1);assert.equal(layout.signers,4);assert.equal(layout.signaturePages,1);assert.equal(layout.overflows,0);
    const pdf=await api("/"+d.id+"/pdf","POST",{version:d.version});await fs.writeFile(path.join(out,"D07-"+scenario+".pdf"),await pdf.body());
    const word=await api("/"+d.id+"/word","POST",{version:d.version});await fs.writeFile(path.join(out,"D07-"+scenario+".docx"),await word.body());
    await frame.locator(".page").first().screenshot({path:path.join(out,"preview-"+scenario+".png")});
    report.scenarios.push({scenario,documentId:d.id,...layout});
  }
  const original=await fs.readFile(path.join(out,"D07-short.pdf")),hash=createHash("sha256").update(original).digest("hex");
  await page.getByLabel("แนบไฟล์อ้างอิง").setInputFiles({name:"e-GP-ตัวอย่าง.pdf",mimeType:"application/pdf",buffer:original});await page.getByText("เก็บไฟล์ต้นฉบับแล้ว เลือกใช้เป็นฉบับหลักได้",{exact:true}).waitFor();
  const record=await(await api("/"+finalId)).json();assert.equal(record.files[0].sha256,hash);const fileId=record.files[0].id;
  await page.getByLabel("ไฟล์ที่ใช้เป็นฉบับหลัก").selectOption(fileId);await page.getByRole("radio",{name:/ใช้ไฟล์ต้นฉบับจากระบบ/}).check();await page.getByRole("button",{name:"บันทึกร่าง",exact:true}).click();await page.getByText(/บันทึกรุ่น 2 แล้ว/).waitFor();await page.reload();assert(await page.getByRole("radio",{name:/ใช้ไฟล์ต้นฉบับจากระบบ/}).isChecked());
  const retrieved=await(await api("/files/"+fileId)).body();assert.equal(createHash("sha256").update(retrieved).digest("hex"),hash);
  await page.getByRole("radio",{name:/ร่างเองจากข้อมูล e-GP/}).check();await page.getByRole("button",{name:"บันทึกร่าง",exact:true}).click();await page.getByText(/บันทึกรุ่น 3 แล้ว/).waitFor();
  report.checks.push("Evidence preserved byte-for-byte; selected primary and draft survive save/reload/mode switch");
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Word",exact:true}).click();const download=await downloadPromise;const basePath=path.join(out,"roundtrip-base.docx");await download.saveAs(basePath);
  const zip=await JSZip.loadAsync(await fs.readFile(basePath));let main=await zip.file("word/document.xml").async("string");
  main=main.replace(/(<w:tag w:val="sarabun:vendorName"[\s\S]*?<w:t[^>]*>)[\s\S]*?(<\/w:t>)/,"$1ร้านแก้ไขจาก Word$2");zip.file("word/document.xml",main);const returned=await zip.generateAsync({type:"nodebuffer"});await fs.writeFile(path.join(out,"roundtrip-returned.docx"),returned);
  await page.getByLabel("ชื่อผู้เสนอราคา / ผู้ขาย",{exact:true}).fill("ร้านแก้ไขในระบบ");await page.getByRole("button",{name:"บันทึกร่าง",exact:true}).click();await page.getByText(/บันทึกรุ่น 4 แล้ว/).waitFor();
  await page.getByLabel("นำ Word กลับ",{exact:true}).setInputFiles({name:"returned.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:returned});await page.getByText("เทียบ Word แล้ว ข้อมูลร่างยังไม่เปลี่ยน",{exact:true}).waitFor();
  assert.equal((await(await api("/"+finalId)).json()).document.data.vendorName,"ร้านแก้ไขในระบบ");await page.getByLabel("เลือกผล ผู้ขาย",{exact:true}).selectOption("word");assert(await page.locator('tr[data-kind="conflict"]').count()>0);
  await page.locator(".lab-review").screenshot({path:path.join(out,"roundtrip-conflict.png")});
  await page.getByRole("button",{name:"บันทึกผลที่เลือกเป็นรุ่นใหม่"}).click();await page.getByText(/รวมข้อมูลและบันทึกเป็นรุ่น 5 แล้ว/).waitFor();assert.equal((await(await api("/"+finalId)).json()).document.data.vendorName,"ร้านแก้ไขจาก Word");
  report.checks.push("Actual UI Word export, concurrent edits, conflict preview without mutation, explicit per-field merge persisted as new revision");
  const primary=await post("",{scenario:"short"});primary.document.data.signingLayout="columns";const cols=await save(primary.document);
  await page.reload();await page.getByRole("combobox",{name:"เลือกเอกสารทดลอง"}).selectOption(cols.document.id);await page.waitForTimeout(1200);
  const columnFrame=page.frameLocator('iframe[title="ตัวอย่างเอกสาร A4"]');const columnPages=await columnFrame.locator(".page").count();
  report.scenarios.push({scenario:"columns",documentId:cols.document.id,pages:columnPages});assert.equal(columnPages,1,"Short document with two-column signing should fit one A4 page");
  for(const kind of ["pdf","word"]){const r=await api("/"+cols.document.id+"/"+kind,"POST",{version:cols.document.version});await fs.writeFile(path.join(out,"D07-columns."+(kind==="word"?"docx":"pdf")),await r.body());}
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector(".lab-preview-wrap").scrollTop=0;});await page.screenshot({path:path.join(out,"workspace.png")});
  const rejected=await context.request.post(origin+"/api/procurement-lab",{headers:{Origin:"https://untrusted.invalid"},data:{scenario:"short"}});assert.equal(rejected.status(),400);report.checks.push("Cross-origin mutations rejected");assert.deepEqual(errors,[]);report.checks.push("No browser runtime errors");
  await fs.writeFile(path.join(out,"validation.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
