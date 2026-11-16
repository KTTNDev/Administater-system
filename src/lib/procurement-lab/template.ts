import "server-only";
import fs from "node:fs";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {PDFDocument} from "pdf-lib";
import {labRoot,hashBytes} from "./store";
import {type TemplateValues} from "./template-model";
import {z} from "zod";
import {D07_REFERENCE_SHA256,TEMPLATE_OUTPUT_VERSION,templateInitial as initial,fillD07Template as fill,validateD07Values as validate} from "../procurement-template";
export {D07_REFERENCE_SHA256,TEMPLATE_OUTPUT_VERSION,blackReminderText} from "../procurement-template";
const execute=promisify(execFile);
export const templateRoot=()=>path.join(labRoot(),"template-d07");
function referenceBytes(){const bytes=fs.readFileSync(path.join(templateRoot(),"reference.docx"));if(hashBytes(bytes)!==D07_REFERENCE_SHA256)throw Error("แม่แบบ D07 เปลี่ยนไป กรุณาตรวจต้นฉบับใหม่ก่อนใช้งาน");return bytes;}
export const templateInitial=()=>initial(referenceBytes());
async function withNewRecipients(input:unknown){const values=input as TemplateValues,initial=await templateInitial();return {...values,directorRecipient:values.directorRecipient??initial.values.directorRecipient,secretaryRecipient:values.secretaryRecipient??initial.values.secretaryRecipient};}
export const fillD07Template=async(input:unknown)=>fill(await withNewRecipients(input),referenceBytes());
const rendering=globalThis as unknown as {d07RenderBusy?:boolean};
export async function createTemplatePreview(input:unknown){
  if(rendering.d07RenderBusy)throw Error("กำลังจัดเอกสารอีกฉบับ กรุณาลองอีกครั้งเมื่อเสร็จ");rendering.d07RenderBusy=true;
  try{
    const built=await fillD07Template(input),id=hashBytes(built.bytes),root=templateRoot(),folder=path.join(root,"generated");fs.mkdirSync(folder,{recursive:true});
    const docx=path.join(folder,id+".docx"),pdf=path.join(folder,id+".pdf"),meta=path.join(folder,id+".json");
    if(!fs.existsSync(meta)){
      fs.writeFileSync(docx,built.bytes);
      await execute("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",path.join(process.cwd(),"scripts/render-procurement-template.ps1"),"-InputPath",docx,"-OutputPath",pdf],{windowsHide:true,timeout:90000,maxBuffer:1_000_000});
      const parsed=await PDFDocument.load(fs.readFileSync(pdf)),pages=parsed.getPageCount();
      const poppler=process.env.SARABUN_PDFTOPPM||path.join(process.env.USERPROFILE||"",".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe");
      if(!fs.existsSync(poppler))throw Error("ไม่พบตัวแสดงหน้า PDF จาก Word (Poppler)");
      await execute(poppler,["-r","120","-png",pdf,path.join(folder,id)],{windowsHide:true,timeout:60000,maxBuffer:1_000_000});
      fs.writeFileSync(meta,JSON.stringify({id,pages,changed:built.changed,sourceHash:built.sourceHash,preservedParts:built.preservedParts,outputVersion:TEMPLATE_OUTPUT_VERSION,approvedChanges:["เปลี่ยนตัวอักษรเตือนสีแดงเป็นสีดำ"],createdAt:new Date().toISOString()}));
    }
    return JSON.parse(fs.readFileSync(meta,"utf8")) as {id:string;pages:number;changed:string[];sourceHash:string;preservedParts:number;outputVersion:string};
  }finally{rendering.d07RenderBusy=false;}
}
export function readTemplateArtifact(id:string,kind:string,pageNumber="1"){
  const root=templateRoot();let file:string;
  const type=z.enum(["pdf","docx","png"]).parse(kind);if(!/^[1-9]\d?$/.test(pageNumber))throw Error("เลขหน้าไม่ถูกต้อง");
  const suffix=type==="png"?"-"+pageNumber+".png":"."+type;
  if(id==="reference")file=path.join(root,"reference"+suffix);
  else{if(!/^[a-f0-9]{64}$/.test(id))throw Error("รหัสเอกสารไม่ถูกต้อง");const m=path.join(root,"generated",id+".json");if(!fs.existsSync(m))throw Error("ยังไม่มีผลจัดเอกสารฉบับนี้");file=path.join(root,"generated",id+suffix);}
  referenceBytes();return fs.readFileSync(file);
}
export async function templateSession(){const initial=await templateInitial(),file=path.join(templateRoot(),"latest.json");if(!fs.existsSync(file))return {initial,saved:null};const saved=JSON.parse(fs.readFileSync(file,"utf8"));saved.values=await withNewRecipients(saved.values);validate(saved.values);return {initial,saved:saved as {values:TemplateValues;result:{id:string;pages:number;changed:string[];sourceHash:string;preservedParts:number}}};}
export function saveTemplateSession(values:TemplateValues,result:unknown){const root=templateRoot(),temporary=path.join(root,"latest.tmp");fs.writeFileSync(temporary,JSON.stringify({values,result}));fs.renameSync(temporary,path.join(root,"latest.json"));}
