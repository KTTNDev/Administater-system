import {z} from 'zod';
import {archiveProcurementAssets} from '@/lib/handover-archive/archive-service';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS,contentDisposition} from '@/lib/procurement/exporters/api';
import {PdfBinderOptionsSchema} from '@/lib/procurement/exporters/profiles';
import {coreOutputFields} from '@/lib/procurement/core/output-schema';
import {corePdfBinder} from '@/lib/procurement/core/output';
import {sqliteRepository} from '@/lib/procurement/storage/sqlite';
export const runtime='nodejs';
const schema=z.object({...coreOutputFields,options:PdfBinderOptionsSchema}).strict();
export async function POST(request:Request){try{
 await guardExportRequest(request);const input=schema.parse(await readExportJson(request)),result=await corePdfBinder(input,input.options);
 try{
  const rec=sqliteRepository.getCase(input.caseId);
  if(rec){
   if(input.options.profile.mode==='SINGLE_DOC'){
    archiveProcurementAssets(rec,{singlePdf:{docId:input.options.profile.docId,title:`เอกสาร_${input.options.profile.docId}`,bytes:result.bytes}});
   }else{
    archiveProcurementAssets(rec,{binderPdf:{filename:'02_รวมเล่มพร้อมพิมพ์.pdf',bytes:result.bytes}});
   }
  }
 }catch{}
 return new Response(new Uint8Array(result.bytes),{headers:{...PRIVATE_HEADERS,'Content-Type':'application/pdf','Content-Disposition':contentDisposition('แฟ้มจัดซื้อจัดจ้างจากร่างที่บันทึก.pdf'),'X-Page-Count':String(result.pageCount),'X-External-File-Count':String(result.externalFileCount),'X-Document-Engine':'core-draft'}});
}catch(error){return exportFailure(error);}}
