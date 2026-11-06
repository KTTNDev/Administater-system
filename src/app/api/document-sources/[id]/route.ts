import {requireUser} from '@/lib/auth';
import {readDocumentSource} from '@/lib/document-sources';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{await requireUser();}catch{return new Response('Unauthorized',{status:401});}
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return new Response('Invalid ID',{status:400});
 try{const source=readDocumentSource(id);return new Response(new Uint8Array(source.file),{headers:{'Content-Type':source.mime,'Content-Disposition':"attachment; filename=original.docx; filename*=UTF-8''"+encodeURIComponent(source.name),'Content-Length':String(source.bytes),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not found',{status:404});}
}
