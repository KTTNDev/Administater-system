import {POST as retiredPost} from '@/app/api/procurement/[[...segments]]/route';
import {requireUser} from '@/lib/auth';
import {LegacyWordRendererDisabledError} from '@/lib/legacy-word-disabled';
export const runtime='nodejs';
export async function GET(){try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401});}return Response.json({error:new LegacyWordRendererDisabledError().message},{status:410,headers:{'Cache-Control':'private, no-store'}});}
export const POST=retiredPost;
