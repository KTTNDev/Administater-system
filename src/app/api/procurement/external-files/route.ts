import {createProcurementExternalAttachment} from '@/lib/attachments';
import {guardExportRequest,limitedBody,exportFailure,PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';

export const runtime='nodejs';
export async function POST(request:Request){
  try{
    await guardExportRequest(request);
    const body=await limitedBody(request,45*1024*1024);
    const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:new Uint8Array(body)}).formData();
    if([...form.keys()].some(k=>k!=='files[]'))throw new Error('กรุณาส่งไฟล์ในช่อง files[] เท่านั้น');
    const files=form.getAll('files[]');
    if(!files.length||files.length>10||files.some(file=>!(file instanceof File)))throw new Error('กรุณาเลือกไฟล์ 1–10 ไฟล์ต่อครั้ง');
    const result=[];
    for(const file of files as File[]){
      result.push(await createProcurementExternalAttachment(file));
    }
    return Response.json(result,{headers:PRIVATE_HEADERS});
  }catch(error){return exportFailure(error);}
}
