import {authenticated} from '@/lib/auth';
import {readProjectFile} from '@/lib/project-db';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{const f=readProjectFile((await params).id);return new Response(new Uint8Array(f.file),{headers:{'Content-Type':f.mime,'Content-Disposition':(new URL(request.url).searchParams.has('download')?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'ไม่พบไฟล์แนบ'},{status:404});}
}
