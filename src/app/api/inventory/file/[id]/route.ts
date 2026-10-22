import {authenticated} from '@/lib/auth';
import {readInventoryFile} from '@/lib/inventory-files';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authenticated())return new Response('Unauthorized',{status:401});
 try{const f=readInventoryFile((await params).id);return new Response(new Uint8Array(f.file),{headers:{'Content-Type':f.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Disposition':(new URL(request.url).searchParams.has('download')?'attachment':'inline')+'; filename="inventory-file"; filename*=UTF-8\'\''+encodeURIComponent(f.name)}});}
 catch{return new Response('ไม่พบไฟล์',{status:404});}
}
