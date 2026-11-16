import 'server-only';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {PDFDocument} from 'pdf-lib';
import {createHash} from 'node:crypto';
import {continuationInfo,continuationFooter} from './procurement-pagination';
import {embedProcurementFont} from './procurement-word-font';
import {printedPageTexts} from './procurement-native-layout';
type Rendered={bytes:Buffer;pages:number;pageTexts:string[]};
const state=globalThis as unknown as {procurementNativePreviewBusy?:boolean;procurementNativePdfCache?:Map<string,Rendered&{at:number}>;procurementFinalWords?:Map<string,Promise<Rendered&{word:Buffer}>>};
/** Render verified template output with a dedicated Word instance, then close it. */
export async function nativeD07Pdf(bytes:Buffer):Promise<Rendered>{
 if(process.platform!=='win32')throw Error('ตัวอย่างนี้ต้องใช้ Microsoft Word บน Windows');
 const hash=createHash('sha256').update('layout-v4').update(bytes).digest('hex'),cache=state.procurementNativePdfCache??=new Map(),cached=cache.get(hash);if(cached&&Date.now()-cached.at<600000)return {bytes:Buffer.from(cached.bytes),pages:cached.pages,pageTexts:cached.pageTexts};
 const waiting=Date.now();while(state.procurementNativePreviewBusy){if(Date.now()-waiting>90000)throw Error('รอจัดหน้าไม่สำเร็จ กรุณาลองใหม่');await new Promise(resolve=>setTimeout(resolve,300));}
 const reused=cache.get(hash);if(reused&&Date.now()-reused.at<600000)return {bytes:Buffer.from(reused.bytes),pages:reused.pages,pageTexts:reused.pageTexts};
 let completed=false;state.procurementNativePreviewBusy=true;const tempRoot=fs.realpathSync.native(os.tmpdir());let folder='';
 try{
  folder=fs.mkdtempSync(path.join(tempRoot,'sarabun-procurement-render-'));fs.writeFileSync(path.join(folder,'.sarabun-render-job'),'SARABUN_PROCUREMENT_RENDER_V1');
  const input=path.join(folder,'draft.docx'),output=path.join(folder,'draft.pdf');fs.writeFileSync(input,bytes);
  const scripts=[path.join(process.cwd(),'scripts/render-procurement-template.ps1'),path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'scripts/render-procurement-template.ps1')],script=scripts.find(file=>fs.existsSync(file));
  if(!script)throw Error('ไม่พบตัวจัดหน้า Word ของระบบ');
  await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-InputPath',input,'-OutputPath',output,'-RenderRoot',folder],{windowsHide:true,timeout:90000,maxBuffer:1000000});
  const pdf=fs.readFileSync(output),pages=(await PDFDocument.load(pdf)).getPageCount(),layout=JSON.parse(fs.readFileSync(output+'.layout.json','utf8').replace(/^\uFEFF/,'')),pageTexts=printedPageTexts(layout,pages);
  completed=true;if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(hash,{bytes:pdf,pages,pageTexts,at:Date.now()});return {bytes:Buffer.from(pdf),pages,pageTexts};
 }finally{
  state.procurementNativePreviewBusy=false;
  if(completed&&folder&&path.dirname(folder)===tempRoot&&path.basename(folder).startsWith('sarabun-procurement-render-')&&fs.existsSync(path.join(folder,'draft.pdf'))&&fs.realpathSync.native(folder)===folder)fs.rmSync(folder,{recursive:true,force:true});
 }
}
/** Layout, then populate per-page cues in the editable Word footer and verify its PDF. */
export async function finalizeProcurementWord(bytes:Buffer){
 const key=createHash('sha256').update('pagination-v7').update(bytes).digest('hex'),cache=state.procurementFinalWords??=new Map();let result=cache.get(key);
 if(!result){if(cache.size>=30)cache.delete(cache.keys().next().value!);result=(async()=>{
  const metadata=await continuationInfo(bytes),input=metadata?await embedProcurementFont(bytes):bytes,first=await nativeD07Pdf(input);
  if(!metadata||metadata.ready||first.pages===1)return {...first,word:input};
  let word=await continuationFooter(input,metadata.info,[]),layout=await nativeD07Pdf(word);
  for(let attempt=0;attempt<3;attempt++){
   word=await continuationFooter(input,metadata.info,layout.pageTexts);const final=await nativeD07Pdf(word);
   if(final.pages===layout.pages&&final.pageTexts.every((text,i)=>text===layout.pageTexts[i]))return {...final,word};
   layout=final;
  }
  throw Error('การแบ่งหน้ายังไม่นิ่ง กรุณาตรวจข้อความและพื้นที่ลงนามก่อนสร้างใหม่');
 })();cache.set(key,result);result.catch(()=>cache.delete(key));}
 return result;
}
