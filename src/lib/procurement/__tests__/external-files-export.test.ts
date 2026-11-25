import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {setSetting} from '../../db';
import {readAttachment} from '../../attachments';
import {defaultAgency} from '../index';
import {templateFixture} from './templates-fixtures';
import {sqliteRepository} from '../storage/sqlite';
import {cloneCaseSafely,newCase,type ExternalFile} from '../workspace/model';
import {bindProcurementCoreDrafts} from '../core/bindings';
import {corePdfBinder,coreWordOutput} from '../core/output';
import {POST as uploadExternal} from '@/app/api/procurement/external-files/route';
import {POST as exportPdf} from '@/app/api/procurement/export/pdf/route';
import {closeProcurementBrowser} from '../exporters/pdf/browser-pool';

let caseId='';

async function makeSamplePdf(pageCount:number){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<pageCount;i++){
    const page=pdf.addPage([595.28,841.89]);
    page.drawText(`External evidence page ${i+1}`,{x:50,y:760,size:14,font});
  }
  return Buffer.from(await pdf.save());
}

function uploadRequest(files:File[],origin='http://localhost',host='localhost'){
  const form=new FormData();
  for(const file of files)form.append('files[]',file);
  return new Request('http://localhost/api/procurement/external-files',{method:'POST',headers:{origin,host},body:form});
}

beforeAll(async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-external-files-'));
  vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));
  vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');
  vi.stubEnv('SARABUN_REQUIRE_LOGIN','false');
  vi.stubEnv('PROCUREMENT_PDF_CONCURRENCY','1');
  setSetting('storage:local',folder);
  const record=sqliteRepository.saveCase({...newCase(),caseInput:templateFixture(),agency:defaultAgency});
  caseId=record.caseInput.id;
  await bindProcurementCoreDrafts(caseId,record.version,'create');
});

afterAll(async()=>{
  await closeProcurementBrowser();
  vi.unstubAllEnvs();
});

it('uploads PDF, JPEG, and WebP external evidence files, rejects unsupported files, and merges them into PDF binder and Word ZIP in exact binder order',async()=>{
  const quotePdf=await makeSamplePdf(2);
  const laasJpg=await sharp({create:{width:600,height:800,channels:3,background:{r:240,g:248,b:245}}}).jpeg({quality:85}).toBuffer();
  const extraWebp=await sharp({create:{width:500,height:400,channels:3,background:{r:245,g:242,b:252}}}).webp({quality:85}).toBuffer();
  const hiddenPng=await sharp({create:{width:300,height:300,channels:3,background:{r:250,g:250,b:250}}}).png().toBuffer();

  // Reject invalid file types and cross-origin requests.
  const badRes=await uploadExternal(uploadRequest([new File([Buffer.from('plain text')],'notes.txt',{type:'text/plain'})]));
  expect(badRes.status).toBe(400);
  const crossRes=await uploadExternal(uploadRequest([new File([quotePdf],'quote.pdf',{type:'application/pdf'})],'https://evil.example','evil.example'));
  expect(crossRes.status).toBe(403);

  // Upload valid PDF + JPEG + WebP + PNG files.
  const okRes=await uploadExternal(uploadRequest([
    new File([quotePdf],'ใบเสนอราคา_ร้านดินสอสี.pdf',{type:'application/pdf'}),
    new File([laasJpg],'รายงานขอซื้อ_elaas.jpg',{type:'image/jpeg'}),
    new File([extraWebp],'หลักฐานเพิ่มเติม.webp',{type:'image/webp'}),
    new File([hiddenPng],'ร่างบิลยังไม่รวม.png',{type:'image/png'}),
  ]));
  expect(okRes.status).toBe(200);
  const uploaded=await okRes.json() as Array<Omit<ExternalFile,'slotId'|'includeInExport'>>;
  expect(uploaded).toHaveLength(4);
  expect(uploaded.map(u=>u.pages)).toEqual([2,1,1,1]);
  for(const item of uploaded){
    const stored=readAttachment(item.id);
    expect(stored.pages).toBe(item.pages);
    expect(stored.file.subarray(0,5).toString()).toBe('%PDF-');
  }

  // Attach files onto binder slots: 4.2 (quote PDF), 5.1 (e-LAAS JPG), 14 (e-LAAS voucher PDF), OTHER (extra WebP), 11.4 (disabled PNG).
  const voucherRes=await uploadExternal(uploadRequest([new File([quotePdf],'ฎีกาเบิกเงิน_elaas.pdf',{type:'application/pdf'})]));
  expect(voucherRes.status).toBe(200);
  const [voucherUploaded]=await voucherRes.json() as Array<Omit<ExternalFile,'slotId'|'includeInExport'>>;
  const current=sqliteRepository.getCase(caseId)!;
  const externalFiles:ExternalFile[]=[
    {...uploaded[0],slotId:'4.2',label:'ใบเสนอราคา ร้านดินสอสี',includeInExport:true},
    {...uploaded[1],slotId:'5.1',label:'รายงานขอซื้อ e-LAAS',includeInExport:true},
    {...voucherUploaded,slotId:'14',label:'เอกสารวางฎีกา e-LAAS',includeInExport:true},
    {...uploaded[2],slotId:'OTHER',label:'เอกสารประกอบเพิ่มเติม',includeInExport:true},
    {...uploaded[3],slotId:'11.4',label:'บิลยังไม่เปิดรวม',includeInExport:false},
  ];
  const saved=sqliteRepository.saveCase({...current,externalFiles});
  expect(saved.externalFiles).toHaveLength(5);
  expect(cloneCaseSafely(saved).externalFiles).toEqual([]);

  // 1. Unified FULL_BINDER PDF export merges enabled external files at their exact binder positions and only inserts dividers for empty external slots.
  const merged=await corePdfBinder({caseId},{profile:{mode:'FULL_BINDER'},duplicateCopies:false,includeDividers:true,includeCoverChecklist:true,includeExternalFiles:true,routingStripMode:'NONE'});
  expect(merged.externalFileCount).toBe(4);
  const mergedPdf=await PDFDocument.load(merged.bytes);
  expect(mergedPdf.getPageCount()).toBe(merged.pageCount);

  const entry42=merged.entries.find(e=>e.docId==='4.2');
  const entry51=merged.entries.find(e=>e.docId==='5.1');
  const entry52=merged.entries.find(e=>e.docId==='5.2');
  const entry114=merged.entries.find(e=>e.docId==='11.4');
  const entry14=merged.entries.find(e=>e.docId==='14');
  const entryOther=merged.entries.find(e=>e.docId==='OTHER');
  expect(entry42?.externalFileId).toBe(uploaded[0].id);
  expect(entry42?.pageCount).toBe(2);
  expect(entry51?.externalFileId).toBe(uploaded[1].id);
  expect(entry51?.pageCount).toBe(1);
  expect(entry14?.externalFileId).toBe(voucherUploaded.id);
  expect(entry14?.pageCount).toBe(2);
  // 5.2 and 11.4 have no enabled external file -> divider sheet inserted instead.
  expect(entry52?.externalFileId).toBeUndefined();
  expect(entry114?.externalFileId).toBeUndefined();
  // OTHER appended at the very end after Doc 14.
  expect(entryOther?.externalFileId).toBe(uploaded[2].id);
  expect(merged.entries.at(-1)?.docId).toBe('OTHER');
  // Order check: 4.1 -> 4.2 -> 5.1 -> 5.2 -> 6.1 ... -> 13 -> 14 -> OTHER.
  const ids=merged.entries.map(e=>e.docId);
  expect(ids.indexOf('4.1')).toBeLessThan(ids.indexOf('4.2'));
  expect(ids.indexOf('4.2')).toBeLessThan(ids.indexOf('5.1'));
  expect(ids.indexOf('5.1')).toBeLessThan(ids.indexOf('5.2'));
  expect(ids.indexOf('5.2')).toBeLessThan(ids.indexOf('6.1'));
  expect(ids.indexOf('13')).toBeLessThan(ids.indexOf('14'));
  expect(ids.indexOf('14')).toBeLessThan(ids.indexOf('OTHER'));

  // 2. SINGLE_DOC PDF export works for external slots (4.2 and OTHER) via API route too.
  const single42Res=await exportPdf(new Request('http://localhost/api/procurement/export/pdf',{
    method:'POST',
    headers:{origin:'http://localhost',host:'localhost','content-type':'application/json'},
    body:JSON.stringify({caseId,options:{profile:{mode:'SINGLE_DOC',docId:'4.2'},duplicateCopies:false,includeDividers:false,includeCoverChecklist:false,includeExternalFiles:true,routingStripMode:'NONE'}}),
  }));
  expect(single42Res.status).toBe(200);
  expect(single42Res.headers.get('X-Page-Count')).toBe('2');
  expect(single42Res.headers.get('X-External-File-Count')).toBe('1');

  const singleOther=await corePdfBinder({caseId},{profile:{mode:'SINGLE_DOC',docId:'OTHER'},duplicateCopies:false,includeDividers:false,includeCoverChecklist:false,includeExternalFiles:true,routingStripMode:'NONE'});
  expect(singleOther.pageCount).toBe(1);
  expect(singleOther.externalFileCount).toBe(1);

  // 3. When includeExternalFiles is false, external files are excluded from the binder.
  const withoutExternal=await corePdfBinder({caseId},{profile:{mode:'SINGLE_DOC',docId:'4.2'},duplicateCopies:false,includeDividers:true,includeCoverChecklist:false,includeExternalFiles:false,routingStripMode:'NONE'});
  expect(withoutExternal.externalFileCount).toBe(0);
  expect(withoutExternal.entries[0]?.externalFileId).toBeUndefined();

  // 4. Word ZIP_ALL export bundles all 15 .docx files AND all enabled external PDFs + updated manifest/checklist.
  const zipOut=await coreWordOutput({caseId},'ZIP_ALL');
  const zip=await JSZip.loadAsync(zipOut.bytes);
  const names=Object.keys(zip.files);
  expect(names.some(n=>n.startsWith('4-2_แนบ01_')&&n.endsWith('.pdf'))).toBe(true);
  expect(names.some(n=>n.startsWith('5-1_แนบ01_')&&n.endsWith('.pdf'))).toBe(true);
  expect(names.some(n=>n.startsWith('14_แนบ01_')&&n.endsWith('.pdf'))).toBe(true);
  expect(names.some(n=>n.startsWith('อื่นๆ_แนบ01_')&&n.endsWith('.pdf'))).toBe(true);
  expect(names.some(n=>n.startsWith('11-4_แนบ01_'))).toBe(false);
  const checklistText=await zip.file('รายการเรียงแฟ้ม.txt')!.async('string');
  expect(checklistText).toContain('4.2 ใบเสนอราคาผู้ชนะ — แนบไฟล์แล้ว 1 ไฟล์ (2 หน้า)');
  expect(checklistText).toContain('14 เอกสารวางฎีกา (e-LAAS) — แนบไฟล์แล้ว 1 ไฟล์ (2 หน้า)');
  expect(checklistText).toContain('อื่นๆ เอกสารหลักฐานเพิ่มเติม — แนบไฟล์แล้ว 1 ไฟล์ (1 หน้า)');
},420000);
