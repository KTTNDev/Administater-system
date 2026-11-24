import {requireUser} from '@/lib/auth';
import {readProcurementArchive,readArchivedProcurementFile,ArchiveFileIntegrityError} from '@/lib/procurement/core/archive';
import {PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
export const runtime='nodejs';
export async function GET(request:Request){
  try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401,headers:PRIVATE_HEADERS});}
  try{
    const id=new URL(request.url).searchParams.get('fileId');
    if(id){const file=readArchivedProcurementFile(id);return new Response(new Uint8Array(file.bytes),{headers:{...PRIVATE_HEADERS,'Content-Type':file.mime,'Content-Disposition':`attachment; filename="archive-document"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff'}});}
    return Response.json(readProcurementArchive(),{headers:PRIVATE_HEADERS});
  }catch(e){return Response.json({error:e instanceof ArchiveFileIntegrityError?e.message:'ไม่พบเอกสารที่จัดเก็บไว้'},{status:e instanceof ArchiveFileIntegrityError?409:404,headers:PRIVATE_HEADERS});}
}
