import {z} from 'zod';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS,contentDisposition} from '@/lib/procurement/exporters/api';
import {PdfBinderOptionsSchema} from '@/lib/procurement/exporters/profiles';
import {coreOutputFields} from '@/lib/procurement/core/output-schema';
import {corePdfBinder} from '@/lib/procurement/core/output';
export const runtime='nodejs';
const schema=z.object({...coreOutputFields,options:PdfBinderOptionsSchema}).strict();
export async function POST(request:Request){try{
 await guardExportRequest(request);const input=schema.parse(await readExportJson(request)),result=await corePdfBinder(input,input.options);
 return new Response(new Uint8Array(result.bytes),{headers:{...PRIVATE_HEADERS,'Content-Type':'application/pdf','Content-Disposition':contentDisposition('แฟ้มจัดซื้อจัดจ้างจากร่างที่บันทึก.pdf'),'X-Page-Count':String(result.pageCount),'X-External-File-Count':String(result.externalFileCount),'X-Document-Engine':'core-draft'}});
}catch(error){return exportFailure(error);}}
