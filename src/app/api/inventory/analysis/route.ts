import {authenticated} from '@/lib/auth';
import {inventorySnapshot} from '@/lib/inventory-db';
import {inventoryAnalytics} from '@/lib/inventory-analytics';
import {inventoryAnalysisCsv,inventoryAnalysisHtml} from '@/lib/inventory-analysis-export';
import {inventoryPdf} from '@/lib/inventory-pdf';
import {documentAssets} from '@/lib/assets';
import {getSetting} from '@/lib/db';
import {daySchema} from '@/lib/inventory';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{const q=new URL(request.url).searchParams,start=daySchema.parse(q.get('start')),end=daySchema.parse(q.get('end')),format=z.enum(['csv','pdf']).parse(q.get('format')),note=z.string().max(500).parse(q.get('note')||'');
 if(start>end||Number(end.slice(0,4))-Number(start.slice(0,4))>20)throw Error('ช่วงวันที่ไม่ถูกต้อง หรือเกิน 20 ปี');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});if(start>today)throw Error('เลือกวันเริ่มต้นไม่เกินวันนี้');const a=inventoryAnalytics(inventorySnapshot(),start,end,today),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(format==='csv')return new Response(inventoryAnalysisCsv(a,note),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inventory-analysis.csv"'}});
 const org=JSON.parse(getSetting('organization')||'{}');return new Response(await inventoryPdf(inventoryAnalysisHtml(a,org.name||'',documentAssets(),note)),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="inventory-analysis.pdf"'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'ส่งออกรายงานไม่สำเร็จ'},{status:400});}
}
