import { requireUser } from "@/lib/auth";
import { readAttachment } from "@/lib/attachments";
import { z } from "zod";
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{await requireUser();}catch{return new Response('Unauthorized',{status:401});}
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return new Response('Invalid ID',{status:400});
 try{const item=readAttachment(id);if(new URL(request.url).searchParams.get('original')==='1'&&item.original)return new Response(new Uint8Array(item.original),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="original"; filename*=UTF-8''${encodeURIComponent(item.originalName||'original')}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});return new Response(new Uint8Array(item.file),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="attachment.pdf"; filename*=UTF-8''${encodeURIComponent(item.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not found',{status:404});}
}
