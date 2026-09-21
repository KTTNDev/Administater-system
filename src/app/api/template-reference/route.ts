import {authenticated} from '@/lib/auth';
import fs from 'node:fs';import path from 'node:path';
export const runtime='nodejs';
export async function GET(){
 if(!await authenticated())return new Response('Unauthorized',{status:401});
 const file=path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'data/template-references/20170502100402.pdf');
 if(!fs.existsSync(file))return new Response('Reference not installed',{status:404});
 return new Response(fs.readFileSync(file),{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':'inline; filename="20170502100402.pdf"'}});
}
