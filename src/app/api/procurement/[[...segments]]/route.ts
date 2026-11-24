import {requireUser} from '@/lib/auth';
import {readProcurementArchive,readArchivedProcurementFile} from '@/lib/procurement/core/archive';
import {LegacyWordRendererDisabledError} from '@/lib/legacy-word-disabled';
import {guardExportRequest,exportFailure,PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
export const runtime='nodejs';
type Context={params:Promise<{segments?:string[]}>};
const retired=()=>Response.json({error:new LegacyWordRendererDisabledError().message},{status:410,headers:PRIVATE_HEADERS});
export async function GET(_request:Request,{params}:Context){
  try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401,headers:PRIVATE_HEADERS});}
  const segments=(await params).segments||[];
  if(!segments.length)return Response.json({...readProcurementArchive(),readOnly:true,template:{ready:false}},{headers:PRIVATE_HEADERS});
  if(segments[0]==='files'&&segments.length===2){try{const file=readArchivedProcurementFile(segments[1]);return new Response(new Uint8Array(file.bytes),{headers:{...PRIVATE_HEADERS,'Content-Type':file.mime,'Content-Disposition':`attachment; filename="archive-document"; filename*=UTF-8''${encodeURIComponent(file.name)}`}});}catch{return Response.json({error:'ไม่พบไฟล์ที่จัดเก็บไว้'},{status:404,headers:PRIVATE_HEADERS});}}
  return retired();
}
export async function POST(request:Request){try{await guardExportRequest(request);return retired();}catch(e){return exportFailure(e);}}
export const PUT=POST;
export const DELETE=POST;
