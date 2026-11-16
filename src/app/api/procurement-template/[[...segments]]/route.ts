import {guardLab} from "@/lib/procurement-lab/server";
import {createTemplatePreview,readTemplateArtifact,saveTemplateSession,templateSession} from "@/lib/procurement-lab/template";
import type {TemplateValues} from "@/lib/procurement-lab/template-model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{segments?:string[]}>}){
  try{await guardLab(request);const [id,kind,page]=(await context.params).segments||[];const bytes=readTemplateArtifact(id,kind,page);return new Response(new Uint8Array(bytes),{headers:{"Content-Type":kind==="png"?"image/png":kind==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":kind==="docx"?'attachment; filename="D07-template.docx"':"inline","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}catch(e){return Response.json({error:e instanceof Error?e.message:"ไม่พบเอกสาร"},{status:404});}
}
export async function POST(request:Request){
  try{await guardLab(request);const reader=request.body?.getReader();if(!reader)throw Error("ไม่มีข้อมูล");const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>50000){await reader.cancel();throw Error("ข้อมูลเกินขอบเขตการทดลอง");}chunks.push(value);}
    const input=JSON.parse(Buffer.concat(chunks).toString("utf8")),result=await createTemplatePreview(input.values);if(input.save!==false)saveTemplateSession(input.values as TemplateValues,result);return Response.json({result});
  }catch(e){const error=e instanceof Error?e.message:"สร้างเอกสารไม่สำเร็จ";return Response.json({error},{status:error==="PROCUREMENT_LAB_DISABLED"?404:400});}
}
