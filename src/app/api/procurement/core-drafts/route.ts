import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {bindProcurementCoreDrafts,listCoreDraftBindings,CoreSyncConflict} from '@/lib/procurement/core/bindings';
import {ConflictError} from '@/lib/procurement/storage/sqlite';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
import {CORE_DOC_IDS} from '@/lib/procurement/core/mapper';
export const runtime='nodejs';
export async function GET(request:Request){
  try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401,headers:PRIVATE_HEADERS});}
  try{const id=z.string().min(1).max(200).parse(new URL(request.url).searchParams.get('caseId'));return Response.json(listCoreDraftBindings(id),{headers:PRIVATE_HEADERS});}catch(e){return exportFailure(e);}
}
export async function POST(request:Request){
  try{
    await guardExportRequest(request);
    const input=z.object({caseId:z.string().min(1).max(200),caseVersion:z.number().int().positive(),mode:z.enum(['create','sync']),expectedVersions:z.record(z.enum(CORE_DOC_IDS),z.number().int().positive()).optional()}).parse(await readExportJson(request));
    return Response.json(await bindProcurementCoreDrafts(input.caseId,input.caseVersion,input.mode,input.expectedVersions),{headers:PRIVATE_HEADERS});
  }catch(e){if(e instanceof ConflictError||e instanceof CoreSyncConflict)return Response.json({error:e.message},{status:409,headers:PRIVATE_HEADERS});return exportFailure(e);}
}
