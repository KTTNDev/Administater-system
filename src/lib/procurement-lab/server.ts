import "server-only";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import {chromium} from "playwright";
import {PDFDocument} from "pdf-lib";
import sharp from "sharp";
import {z} from "zod";
import {requireUser} from "../auth";
import {labAssets} from "./assets";
import {procurementHtml} from "./render";
import {compareFields,fieldValues,type LabDocument,type MergeChoice} from "./model";
import {labRoot,createLabSample,readLabDocument,saveLabDocument,labSourceFiles,addLabSource,recordLabExport,hashFields,readLabExport,createLabReview,applyLabReview,readLabBinary,listLabDocuments} from "./store";
import {makeLabWord,parseLabWord} from "./word";

const MAX_BODY=11_000_000;
export async function guardLab(request?:Request){
  labRoot();await requireUser();
  if(request&&!["GET","HEAD"].includes(request.method)){
    const origin=request.headers.get("origin"),url=new URL(request.url),host=request.headers.get("host");
    if(!origin||!host||new URL(origin).host!==host||new URL(origin).protocol!==url.protocol)throw Error("ไม่อนุญาตคำขอข้ามเว็บไซต์");
  }
}
async function bounded(request:Request){
  if(Number(request.headers.get("content-length")||0)>MAX_BODY)throw Error("ไฟล์ใหญ่เกิน 10 MB");
  const reader=request.body?.getReader();if(!reader)throw Error("ไม่มีข้อมูลคำขอ");const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error("ข้อมูลใหญ่เกินขอบเขต");}chunks.push(value);}
  return Buffer.concat(chunks);
}
async function json(request:Request){return JSON.parse((await bounded(request)).toString("utf8"));}
async function upload(request:Request){
  const bytes=await bounded(request),form=await new Response(bytes,{headers:{"content-type":request.headers.get("content-type")||""}}).formData();
  const f=form.get("file"),requestId=z.string().uuid().parse(form.get("requestId"));if(!(f instanceof File)||f.size>10_000_000||!f.size)throw Error("เลือกไฟล์ขนาดไม่เกิน 10 MB");
  const name=f.name.replace(/[\x00-\x1f\\/]/g,"_").slice(0,200);return {bytes:Buffer.from(await f.arrayBuffer()),name,requestId};
}
export async function renderLabPdf(data:LabDocument){
  const executablePath=[process.env.SARABUN_CHROME,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>p&&fs.existsSync(p));
  if(!executablePath)throw Error("ไม่พบ Chrome หรือ Edge สำหรับสร้าง PDF");
  const browser=await chromium.launch({executablePath,headless:true});
  try{const page=await browser.newPage();await page.route("**/*",route=>route.request().url().startsWith("data:")?route.continue():route.abort());await page.setContent(procurementHtml(data,labAssets()));await page.waitForFunction(()=>Boolean((window as unknown as {__procurementReady?:boolean}).__procurementReady),{},{timeout:30000});
    if(await page.evaluate(()=>Boolean((window as unknown as {__overflow?:boolean}).__overflow)))throw Error("มีข้อความหรือชุดลายเซ็นเกินพื้นที่หน้า กรุณาปรับเนื้อหาก่อนส่งออก");
    return await page.pdf({format:"A4",printBackground:true,preferCSSPageSize:true});
  }finally{await browser.close();}
}
const download=(bytes:Buffer,mime:string,name:string,inline=false)=>new Response(new Uint8Array(bytes),{headers:{"Content-Type":mime,"Content-Disposition":`${inline?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export async function labHandler(request:Request,segments:string[]){
  try{
    await guardLab(request);const [documentId,action]=segments;
    if(documentId==="files"&&request.method==="GET"){const f=readLabBinary(action);return download(f.bytes,f.mime,f.name,["application/pdf","image/png","image/jpeg"].includes(f.mime));}
    if(!documentId){if(request.method==="GET")return Response.json({documents:listLabDocuments()});if(request.method==="POST"){const v=z.object({scenario:z.enum(["short","long","longer"])}).parse(await json(request));return Response.json({document:createLabSample(v.scenario),files:[]});}}
    if(!documentId)throw Error("ไม่พบรายการ");
    const current=readLabDocument(documentId);
    if(!action){if(request.method==="GET")return Response.json({document:current,files:labSourceFiles(documentId)});if(request.method==="PUT"){const v=await json(request);return Response.json({document:saveLabDocument(documentId,v.version,v.data),files:labSourceFiles(documentId)});}}
    if(action==="sources"&&request.method==="POST"){
      const f=await upload(request);let mime="",text="";
      if(/\.pdf$/i.test(f.name)){const p=await PDFDocument.load(f.bytes);if(p.getPageCount()>200)throw Error("ห้องทดลองรองรับ PDF ไม่เกิน 200 หน้า");mime="application/pdf";}
      else if(/\.(png|jpe?g)$/i.test(f.name)){const m=await sharp(f.bytes,{limitInputPixels:40_000_000}).metadata();if(!["png","jpeg"].includes(m.format||""))throw Error("รูปภาพไม่ตรงกับชนิดที่อนุญาต");mime=m.format==="png"?"image/png":"image/jpeg";}
      else if(/\.docx$/i.test(f.name)){text=(await parseLabWord(f.bytes)).plainText;mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";}
      else throw Error("รองรับ PDF, PNG, JPG และ DOCX เท่านั้น");
      return Response.json({files:addLabSource(documentId,{id:f.requestId,name:f.name,mime,bytes:f.bytes,text})});
    }
    if(["word","pdf"].includes(action)&&request.method==="POST"){
      const {version}=z.object({version:z.number().int().positive()}).parse(await json(request));if(current.version!==version)throw Error("กรุณาโหลดหรือบันทึกฉบับล่าสุดก่อนส่งออก");
      if(current.data.mode==="source")throw Error("โหมดไฟล์ต้นฉบับให้ดาวน์โหลดไฟล์หลักที่เลือกไว้");
      if(action==="pdf")return download(await renderLabPdf(current.data),"application/pdf","D07-ฉบับร่าง-v"+version+".pdf");
      const base=fieldValues(current.data),baseHash=hashFields(base),exportId=randomUUID(),built=await makeLabWord(current.data,{format:"sarabun-procurement/1",documentId,exportId,baseHash});
      recordLabExport({id:exportId,documentId,version,base,baseHash,outsideText:built.outsideText},built.bytes);
      return download(built.bytes,"application/vnd.openxmlformats-officedocument.wordprocessingml.document","D07-ฉบับร่าง-v"+version+".docx");
    }
    if(action==="review"&&request.method==="POST"){
      const f=await upload(request);if(!/\.docx$/i.test(f.name))throw Error("เลือก Word .docx ที่ส่งออกจากห้องทดลองนี้");const parsed=await parseLabWord(f.bytes);
      if(!parsed.meta)throw Error("ไม่พบรหัสฉบับฐาน: ใช้ Word ที่ส่งออกจากห้องทดลองนี้เพื่อเทียบสามรุ่น");
      const baseline=readLabExport(parsed.meta.exportId);if(baseline.documentId!==documentId||parsed.meta.documentId!==documentId||baseline.baseHash!==parsed.meta.baseHash)throw Error("ข้อมูลฉบับฐานไม่ตรงกับเอกสารนี้");
      const unmapped=[...parsed.warnings];
      if(JSON.stringify(parsed.outsideText)!==JSON.stringify(baseline.outsideText))unmapped.push("ข้อความนอกช่องข้อมูลเปลี่ยนไป (รวมยอดที่แสดงหรือข้อความเพิ่ม): เก็บไฟล์นำกลับไว้ครบ แต่ยังไม่รวมข้อความส่วนนี้อัตโนมัติ กรุณาตรวจและคัดลอกลงช่องที่เกี่ยวข้องเอง");
      const known=new Set(Object.keys(fieldValues(current.data)));for(const [key,value] of Object.entries(parsed.fields))if(!known.has(key))unmapped.push("ช่องที่ไม่มีในร่างปัจจุบัน "+key+": "+value);
      const review=createLabReview(documentId,{exportId:baseline.id,oursVersion:current.version,exportVersion:baseline.version,diffs:compareFields(baseline.base,current.data,parsed.fields),unmapped,warnings:["การจัดหน้า รูปแบบตัวอักษร และตำแหน่งใน Word ไม่ถูกนำมาทับแม่แบบ ระบบจัดหน้าใหม่จากข้อมูลที่เลือก"],name:f.name},f.bytes,f.requestId);
      return Response.json({review});
    }
    if(action==="merge"&&request.method==="POST"){
      const v=z.object({reviewId:z.string().uuid(),choices:z.record(z.string(),z.object({choice:z.enum(["ours","word","manual"]),value:z.string().optional()})),acknowledgeUnmapped:z.boolean()}).parse(await json(request));
      return Response.json(applyLabReview(documentId,v.reviewId,v.choices as Record<string,MergeChoice>,v.acknowledgeUnmapped));
    }
    return Response.json({error:"ไม่พบเส้นทางทดลอง"},{status:404});
  }catch(e){const message=e instanceof Error?e.message:"ทำรายการไม่สำเร็จ";return Response.json({error:message==="PROCUREMENT_LAB_DISABLED"?"ไม่เปิดห้องทดลอง":message},{status:message==="PROCUREMENT_LAB_DISABLED"?404:400});}
}
