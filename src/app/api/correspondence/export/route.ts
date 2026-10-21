import {authenticated} from '@/lib/auth';
import {listRegister,readRegister,registerHistory} from '@/lib/correspondence-db';
import {filterRegister,registerFilterSchema} from '@/lib/correspondence';
import {csv,registerCsv,statisticsRows,historyCsv,registerHtml} from '@/lib/correspondence-export';
import {documentAssets} from '@/lib/assets';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{
 const query=new URL(request.url).searchParams,mode=z.enum(['csv','stats-csv','history-csv','pdf','stats-pdf','stamp-pdf']).parse(query.get('mode')||'csv');
 const recordExport=mode==='stamp-pdf'||mode==='history-csv';
 const parsedFilter=registerFilterSchema.safeParse(recordExport?{}:Object.fromEntries(['direction','department','start','end','query','status'].map(k=>[k,query.get(k)||''])));
 if(!parsedFilter.success)return Response.json({error:'เงื่อนไขรายงานไม่ถูกต้อง: '+parsedFilter.error.issues[0].message},{status:400});
 const filter=parsedFilter.data;
 const id=query.get('id'),entries=mode==='stamp-pdf'?[readRegister(z.string().uuid().parse(id))]:filterRegister(listRegister(),filter);
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(mode.endsWith('csv')){const body=mode==='history-csv'?historyCsv(registerHistory(z.string().uuid().parse(id))):mode==='stats-csv'?csv(statisticsRows(entries)):registerCsv(entries);return new Response(body,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="correspondence-${mode}.csv"`}});}
 if(entries.length>3000)return Response.json({error:'กรุณาแบ่งช่วงวันที่ให้ไม่เกิน 3,000 รายการต่อ PDF หรือใช้ CSV'},{status:400});
 if(mode==='stamp-pdf'&&entries[0].direction!=='incoming')return Response.json({error:'ตรารับใช้กับทะเบียนรับเท่านั้น'},{status:400});
 const assets=documentAssets(),html=registerHtml(entries,{mode:mode==='stats-pdf'?'stats':mode==='stamp-pdf'?'stamp':'book',description:[filter.department||'ทุกหน่วยงาน',`${filter.start||'เริ่มต้น'} ถึง ${filter.end||'ล่าสุด'}`,filter.query?`คำค้น ${filter.query}`:'',filter.status?`สถานะ ${filter.status}`:'',`ออกรายงาน ${new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}`].filter(Boolean).join(' · '),font:assets.regular,bold:assets.bold});
 const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({headless:true,executablePath});try{const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(html);await page.evaluate(()=>document.fonts.ready);const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="correspondence-${mode}.pdf"`}});}finally{await browser.close();}
 }catch(error){console.error('Correspondence export failed',error instanceof Error?error.message:'unknown');return Response.json({error:'ส่งออกไม่สำเร็จ กรุณาตรวจรายการและลองใหม่'},{status:400});}
}
