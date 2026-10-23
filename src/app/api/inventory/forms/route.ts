import {authenticated} from '@/lib/auth';
import {readInventoryForm} from '@/lib/inventory-form-db';
import {inventoryFormHtml} from '@/lib/inventory-form-render';
import {inventoryOfficeFile} from '@/lib/inventory-form-office';
import {inventoryPdf} from '@/lib/inventory-pdf';
import {documentAssets} from '@/lib/assets';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{const q=new URL(request.url).searchParams,id=z.string().uuid().parse(q.get('id')),format=z.enum(['preview','pdf','office']).parse(q.get('format')),d=readInventoryForm(id),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(format==='office'){const ext='docx',mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';return new Response(new Uint8Array(await inventoryOfficeFile(d)),{headers:{...headers,'Content-Type':mime,'Content-Disposition':"attachment; filename=\"inventory-form-"+d.templateId+"."+ext+"\"; filename*=UTF-8''"+encodeURIComponent(d.title+'.'+ext)}});}
 const html=inventoryFormHtml(d,false,documentAssets());
 if(format==='preview')return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'"}});
 return new Response(await inventoryPdf(html),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="inventory-form-'+d.templateId+'.pdf"'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'ส่งออกไม่สำเร็จ'},{status:400});}
}
