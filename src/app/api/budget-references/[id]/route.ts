import {requireUser} from '@/lib/auth';
import {referenceSources} from '@/lib/budget-references';
import fs from 'node:fs';
import path from 'node:path';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireUser();const {id}=await params;
 if(!Object.hasOwn(referenceSources,id))return new Response('Not found',{status:404});
 const file=path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'data','budget-references',id+'.pdf');
 if(!fs.existsSync(file))return new Response('Reference PDF unavailable',{status:404});
 return new Response(fs.readFileSync(file),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
