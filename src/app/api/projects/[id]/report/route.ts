import {localReportSource,saveLocalReportOutput} from '@/lib/local-dossiers';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {authenticated} from '@/lib/auth';
import {getSetting} from '@/lib/db';
import {listOffice} from '@/lib/office-db';
import {projectFiles,readProject,readProjectFile} from '@/lib/project-db';
import {projectReportHtml,projectReportWord} from '@/lib/project-report';
import {documentAssets} from '@/lib/assets';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authenticated())return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 try{
 const id=(await params).id,project=readProject(id),q=new URL(request.url).searchParams,format=q.get('format')||'pdf';
 if(!['pdf','word'].includes(format))throw Error('รูปแบบไม่ถูกต้อง');
 const source=localReportSource('project',id,'รูปเล่มโครงการ');
 const assets=documentAssets(),input={project,items:listOffice(),files:projectFiles(id).map(f=>f.includeInReport?readProjectFile(f.id):{...f,file:Buffer.alloc(0)}),organization:JSON.parse(getSetting('organization')||'{}').name||'',font:assets.regular,bold:assets.bold};
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(format==='word'){const bytes=await projectReportWord(input);saveLocalReportOutput(source,'docx',bytes);return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(project.title+'.docx')}});}
 const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({headless:true,executablePath});let main:Buffer;
 try{const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(projectReportHtml(input));await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})))});main=await page.pdf({preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;text-align:center;font-size:9px"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'});}finally{await browser.close();}
 const result=await PDFDocument.load(main);for(const file of input.files.filter(f=>f.includeInReport&&f.mime==='application/pdf')){const appendix=await PDFDocument.load(file.file);for(const page of await result.copyPages(appendix,appendix.getPageIndices()))result.addPage(page);}
 const bytes=await result.save();if(q.has('download'))saveLocalReportOutput(source,'pdf',bytes);
 return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':(q.has('download')?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(project.title+'.pdf')}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'จัดรูปเล่มไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:400});}
}
