import {authenticated} from '@/lib/auth';
import {inventorySnapshot,readMovement} from '@/lib/inventory-db';
import {filterMovements,daySchema} from '@/lib/inventory';
import {inventoryCsv,inventoryHtml} from '@/lib/inventory-export';
import {getSetting} from '@/lib/db';
import {documentAssets} from '@/lib/assets';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{const q=new URL(request.url).searchParams,mode=z.enum(['form','report','csv']).parse(q.get('mode')),start=q.get('start')||'',end=q.get('end')||'',query=z.string().max(300).parse(q.get('q')||'');if(start)daySchema.parse(start);if(end)daySchema.parse(end);if(start&&end&&start>end)throw Error('วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น');
 const data=inventorySnapshot(),rows=mode==='form'?[readMovement(z.string().uuid().parse(q.get('id')))]:filterMovements(data.movements,start,end,query);
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(mode==='csv')return new Response(inventoryCsv(rows),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inventory.csv"'}});
 const assets=documentAssets(),org=JSON.parse(getSetting('organization')||'{}'),html=inventoryHtml(rows,{form:mode==='form',organization:org.name||'',font:assets.regular,bold:assets.bold,start,end,items:data.items});
 const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({headless:true,executablePath});try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(html);await page.evaluate(()=>document.fonts.ready);const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});return new Response(new Uint8Array(pdf),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="inventory.pdf"'}});}finally{await browser.close();}
 }catch(e){return Response.json({error:e instanceof Error?e.message:'ส่งออกไม่สำเร็จ'},{status:400});}
}
