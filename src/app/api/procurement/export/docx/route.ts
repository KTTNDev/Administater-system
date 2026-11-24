import {z} from 'zod';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS,contentDisposition} from '@/lib/procurement/exporters/api';
import {GeneratedDocIdSchema} from '@/lib/procurement/exporters/profiles';
import {coreOutputFields} from '@/lib/procurement/core/output-schema';
import {coreWordOutput} from '@/lib/procurement/core/output';
export const runtime='nodejs';
const schema=z.discriminatedUnion('mode',[z.object({...coreOutputFields,mode:z.literal('ZIP_ALL')}).strict(),z.object({...coreOutputFields,mode:z.literal('SINGLE_DOC'),docId:GeneratedDocIdSchema}).strict()]);
export async function POST(request:Request){try{
 await guardExportRequest(request);const input=schema.parse(await readExportJson(request)),result=await coreWordOutput(input,input.mode,input.mode==='SINGLE_DOC'?input.docId:undefined);
 return new Response(new Uint8Array(result.bytes),{headers:{...PRIVATE_HEADERS,'Content-Type':result.mime,'Content-Disposition':contentDisposition(result.filename),'X-Document-Engine':'core-draft'}});
}catch(error){return exportFailure(error);}}
