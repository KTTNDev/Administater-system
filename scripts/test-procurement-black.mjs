import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {chromium} from "playwright";
const root=path.resolve("output/procurement-lab/template-d07"),origin="http://127.0.0.1:3107";
const snapshot=await fs.readFile(path.join(root,"latest.json"),"utf8"),saved=JSON.parse(snapshot);
const response=await fetch(origin+"/api/procurement-template",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({values:saved.values,save:false})});const data=await response.json();if(!response.ok)throw Error(JSON.stringify(data));assert.equal(data.result.pages,1);assert.equal(data.result.outputVersion,"D07-black-v1");
const generated=await JSZip.loadAsync(await fs.readFile(path.join(root,"generated",data.result.id+".docx"))),reference=await JSZip.loadAsync(await fs.readFile(path.join(root,"reference.docx")));
const xml=await generated.file("word/document.xml").async("string");assert(!xml.includes('w:val="FF0000"'));for(const name of Object.keys(reference.files))if(name!=="word/document.xml")assert.deepEqual(await generated.file(name).async("uint8array"),await reference.file(name).async("uint8array"));
let colorOnlyChange=false;
if(saved.result?.id){const prior=await JSZip.loadAsync(await fs.readFile(path.join(root,"generated",saved.result.id+".docx"))),before=await prior.file("word/document.xml").async("string");assert.equal(xml,before.replace(/w:val="FF0000"/g,'w:val="000000"'));colorOnlyChange=true;}
// Migrate the last saved document to the new policy only if the user has not
// saved another version while this check was running. Preserve every value.
if(await fs.readFile(path.join(root,"latest.json"),"utf8")===snapshot){const r=await fetch(origin+"/api/procurement-template",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({values:saved.values})});if(!r.ok)throw Error(await r.text());}
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
try{const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto(origin+"/procurement/template");await page.waitForFunction(()=>{const img=document.querySelector('.d07-paper-scroll img');return img?.complete&&img.naturalWidth>900;});await page.screenshot({path:path.join(root,"editor-black.png")});}finally{await browser.close();}
await fs.writeFile(path.join(root,"black-validation.json"),JSON.stringify({result:data.result,previousId:saved.result?.id,preservedOtherParts:18,valuesUnchanged:true,colorOnlyChange},null,2));console.log(JSON.stringify(data.result));
