import 'server-only';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import {newDraft,type SavedDraft} from '../../document';
import {readAttachment} from '../../attachments';
import {withPdfRenderer} from '../../pdf';
import {renderWord} from '../../word';
import {sqliteRepository} from '../storage/sqlite';
import {ProcurementCaseInputSchema} from '../schema';
import {cleanForExport,type ExternalFile} from '../workspace/model';
import {listCoreDraftBindings} from './bindings';
import {buildBinderManifest} from '../manifest';
import {PdfBinderOptionsSchema,selectBinderEntries,type PdfBinderOptions} from '../exporters/profiles';
import {ExportRequestError,validatedCase} from '../exporters/api';
import type {GeneratedDocId} from '../templates/ir';
export type CoreOutputInput={caseId:string;caseVersion?:number;expectedVersions?:Partial<Record<GeneratedDocId,number>>;allowExportWithErrors?:boolean};
function fail(messageTh:string,status=409):never{throw new ExportRequestError([{code:'CORE_DRAFT_REQUIRED',severity:'ERROR',docIds:[],messageTh}],status);}
export function coreOutputCase(input:CoreOutputInput){
 const record=sqliteRepository.getCase(input.caseId);if(!record)fail('ไม่พบงานจัดซื้อจัดจ้าง',404);
 if(input.caseVersion!==undefined&&record.version!==input.caseVersion)fail('ข้อมูลกลางเปลี่ยนไปแล้ว กรุณาโหลดงานล่าสุดก่อนส่งออก');
 const links=listCoreDraftBindings(input.caseId);
 function draft(docId:string):SavedDraft{
  const link=links.find(row=>row.doc_id===docId);if(!link)fail('กรุณากดสร้างชุดร่างเอกสารในระบบหลักก่อนดูตัวอย่างหรือส่งออก');
  if(!link.draft)fail('เอกสาร '+docId+' อยู่ในถังขยะ กรุณากู้คืนร่างเดิมก่อน');
  if(input.expectedVersions&&input.expectedVersions[link.doc_id]!==link.draft.version)fail('ร่างหนังสือเปลี่ยนไปแล้ว กรุณาโหลดฉบับล่าสุดก่อนส่งออก');
  return link.draft;
 }
 return {record,links,draft};
}
const safeName=(value:string)=>value.replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,110)||'เอกสาร';
const validatedSource=(source:ReturnType<typeof coreOutputCase>,input:CoreOutputInput)=>validatedCase({caseInput:ProcurementCaseInputSchema.parse(cleanForExport(source.record.caseInput)),agency:source.record.agency,allowExportWithErrors:input.allowExportWithErrors??false});
const groupExternalFiles=(files:readonly ExternalFile[])=>{
 const map=new Map<string,ExternalFile[]>();
 for(const file of files){
  if(!file.includeInExport)continue;
  const list=map.get(file.slotId)??[];
  list.push(file);
  map.set(file.slotId,list);
 }
 return map;
};
/** Official pages use saved Core drafts and merge uploaded external evidence in binder order. Never map or implicitly Sync during output. */
export async function corePdfBinder(input:CoreOutputInput,rawOptions:PdfBinderOptions){
 const options=PdfBinderOptionsSchema.parse(rawOptions);
 const source=coreOutputCase(input),computed=validatedSource(source,input);
 const rows=selectBinderEntries(computed,options.profile);
 const drafts=new Map(rows.filter(row=>row.source==='GENERATED').map(row=>[row.docId,source.draft(row.docId)]));
 const includeExternal=options.includeExternalFiles;
 const externalBySlot=includeExternal?groupExternalFiles(source.record.externalFiles??[]):new Map<string,ExternalFile[]>();
 const binder=await PDFDocument.create(),entries:Array<{docId:string;draftId?:string;version?:number;externalFileId?:string;externalLabel?:string;copy:number;startPage:number;pageCount:number}>=[];
 let externalFileCount=0;
 const append=async(bytes:Uint8Array,entry:Omit<typeof entries[number],'startPage'|'pageCount'>)=>{
  const pdf=await PDFDocument.load(bytes),startPage=binder.getPageCount()+1;
  for(const page of await binder.copyPages(pdf,pdf.getPageIndices()))binder.addPage(page);
  entries.push({...entry,startPage,pageCount:pdf.getPageCount()});
 };
 const appendExternalSlot=async(slotId:string)=>{
  const files=externalBySlot.get(slotId)??[];
  for(const file of files){
   const stored=readAttachment(file.id);
   await append(stored.file,{docId:slotId,copy:1,externalFileId:file.id,externalLabel:file.label||file.name});
   externalFileCount++;
  }
  return files.length;
 };
 return await withPdfRenderer(async render=>{
  const sheet=async(subject:string,body:string)=>render({...newDraft('other'),subject,body,date:'',organization:source.record.agency.municipalityName,numeralStyle:'thai',otherShowSignatures:false});
  if(options.includeCoverChecklist){
   const checklistRows=rows.map(row=>{
    const ext=externalBySlot.get(row.docId)??[];
    const extPages=ext.reduce((n,f)=>n+f.pages,0);
    const col=row.source==='GENERATED'
     ? `${options.duplicateCopies?row.copies:1} ชุด${ext.length?` + แนบ ${ext.length} ไฟล์ (${extPages} หน้า)`:''}`
     : ext.length?`แนบไฟล์แล้ว (${ext.length} ไฟล์ · ${extPages} หน้า)`:'แทรกต้นฉบับ';
    return `| ${row.docId} ${row.title} | ${col} | ☐ |`;
   });
   const otherFiles=options.profile.mode==='FULL_BINDER'?(externalBySlot.get('OTHER')??[]):[];
   if(otherFiles.length)checklistRows.push(`| อื่นๆ เอกสารหลักฐานเพิ่มเติม | แนบไฟล์แล้ว (${otherFiles.length} ไฟล์ · ${otherFiles.reduce((n,f)=>n+f.pages,0)} หน้า) | ☐ |`);
   await append(await sheet('รายการเรียงแฟ้ม',`| เอกสาร | จำนวนชุด / ไฟล์แนบ | ตรวจครบ |\n| --- | --- | --- |\n${checklistRows.join('\n')}`),{docId:'COVER',copy:1});
  }
  for(const row of rows){
   if(row.source!=='GENERATED'){
    const added=await appendExternalSlot(row.docId);
    if(!added&&options.includeDividers)await append(await sheet('แผ่นคั่นเอกสารต้นฉบับ',`${row.docId} ${row.title}\nแทรกเอกสารจาก${row.source==='VENDOR_EXTERNAL'?'ร้านค้า':row.source==='LAAS_EXTERNAL'?'ระบบ e-LAAS':'ระบบ e-GP / e-LAAS'}\nตรวจเลขที่และวันที่กับต้นฉบับก่อนจัดแฟ้ม\nแผ่นนี้เป็นแผ่นคั่น ไม่ใช่เอกสารต้นฉบับ`),{docId:row.docId,copy:1});
    continue;
   }
   const draft=drafts.get(row.docId)!,bytes=await render(draft);
   for(let copy=1;copy<=(options.duplicateCopies?row.copies:1);copy++)await append(bytes,{docId:row.docId,draftId:draft.id,version:draft.version,copy});
   await appendExternalSlot(row.docId);
  }
  if(options.profile.mode==='FULL_BINDER'||(options.profile.mode==='SINGLE_DOC'&&options.profile.docId==='OTHER')){
   await appendExternalSlot('OTHER');
  }
  if(!binder.getPageCount())fail('ไม่มีเอกสารในชุดที่เลือก กรุณาอัปโหลดไฟล์แนบ หรือเลือกเอกสารหรือแผ่นคั่น',400);
  return {bytes:Buffer.from(await binder.save()),pageCount:binder.getPageCount(),entries,externalFileCount};
 });
}
export async function coreWordOutput(input:CoreOutputInput,mode:'SINGLE_DOC'|'ZIP_ALL',docId?:GeneratedDocId){
 const source=coreOutputCase(input);
 const computed=validatedSource(source,input);
 if(mode==='SINGLE_DOC'){
  const draft=source.draft(docId!);return {bytes:await renderWord(draft),filename:safeName(draft.subject)+'.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 }
 const rows=buildBinderManifest(computed),externalBySlot=groupExternalFiles(source.record.externalFiles??[]);
 const zip=new JSZip(),manifest:Array<Record<string,unknown>>=[],usedNames=new Set<string>();
 const uniqueName=(candidate:string)=>{let name=candidate,n=2;while(usedNames.has(name.toLowerCase())){const dot=candidate.lastIndexOf('.');name=dot>0?`${candidate.slice(0,dot)}_${n}${candidate.slice(dot)}`:`${candidate}_${n}`;n++;}usedNames.add(name.toLowerCase());return name;};
 const addExternalZipFiles=(slotId:string,prefix:string)=>{
  const files=externalBySlot.get(slotId)??[];
  files.forEach((file,index)=>{
   const stored=readAttachment(file.id);
   const base=safeName(file.label||file.name.replace(/\.pdf$/i,''));
   const filename=uniqueName(`${prefix}_แนบ${String(index+1).padStart(2,'0')}_${base}.pdf`);
   zip.file(filename,stored.file);
   manifest.push({docId:slotId,source:'EXTERNAL',externalFileId:file.id,pages:file.pages,filename});
  });
  return files;
 };
 const checklistLines:string[]=[];
 for(const row of rows){
  if(row.source==='GENERATED'){
   const draft=source.draft(row.docId);
   const name=uniqueName(`${row.docId.replace('.','-')}_${safeName(draft.subject)}.docx`);
   zip.file(name,await renderWord(draft));
   manifest.push({docId:row.docId,source:'GENERATED',draftId:draft.id,version:draft.version,filename:name});
   const extra=addExternalZipFiles(row.docId,row.docId.replace('.','-'));
   checklistLines.push(`${row.docId} ${row.title} — พิมพ์ ${row.copies} ชุด${extra.length?` (+ แนบหลักฐาน ${extra.length} ไฟล์)`:''}`);
  }else{
   const attached=addExternalZipFiles(row.docId,row.docId.replace('.','-'));
   checklistLines.push(`${row.docId} ${row.title} — ${attached.length?`แนบไฟล์แล้ว ${attached.length} ไฟล์ (${attached.reduce((n,f)=>n+f.pages,0)} หน้า)`:'แทรกเอกสารต้นฉบับ'}`);
  }
 }
 const otherFiles=addExternalZipFiles('OTHER','อื่นๆ');
 if(otherFiles.length)checklistLines.push(`อื่นๆ เอกสารหลักฐานเพิ่มเติม — แนบไฟล์แล้ว ${otherFiles.length} ไฟล์ (${otherFiles.reduce((n,f)=>n+f.pages,0)} หน้า)`);
 zip.file('รายการเอกสาร.json',JSON.stringify(manifest,null,2));
 zip.file('รายการเรียงแฟ้ม.txt','\uFEFF'+checklistLines.join('\r\n'));
 return {bytes:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}),filename:'เอกสารจัดซื้อจัดจ้างจากร่างที่บันทึก.zip',mime:'application/zip'};
}
