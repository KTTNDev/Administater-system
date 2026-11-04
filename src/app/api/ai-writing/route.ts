import {authenticated} from '@/lib/auth';
import {writingRequestSchema} from '@/lib/ai-writing';
import {generateWriting,listWritingModels,WritingError} from '@/lib/gemini-writing';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
const maxBytes=96*1024;

// Check before reading credentials. This local-only feature must not be callable
// by an unrelated website opened in another browser tab (including with login off).
export async function POST(request:Request) {
  try{
    const origin=new URL(request.headers.get('origin')||'');
    if(!['http:','https:'].includes(origin.protocol)||origin.host!==request.headers.get('host'))return reply({error:'กรุณาเปิดเมนูช่วยเขียนจากระบบสารบรรณโดยตรง'},403);
  }catch{return reply({error:'ไม่พบแหล่งที่มาของคำขอ'},403);}
  if(!await authenticated())return reply({error:'กรุณาเข้าสู่ระบบใหม่'},401);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'รูปแบบคำขอไม่ถูกต้อง'},415);
  const controller=new AbortController();
  const signal=AbortSignal.any([request.signal,controller.signal,AbortSignal.timeout(60000)]);
  try{
    // Do not trust Content-Length alone: streamed bodies must be bounded too.
    if(Number(request.headers.get('content-length'))>maxBytes)throw new WritingError(413,'ข้อมูลยาวเกินไป กรุณาลดข้อความ');
    const reader=request.body?.getReader();if(!reader)throw new WritingError(400,'ไม่พบข้อมูลคำขอ');
    const chunks:Uint8Array[]=[];let bytes=0;
    const cancelRead=()=>{void reader.cancel().catch(()=>{});};
    signal.addEventListener('abort',cancelRead,{once:true});
    try{while(true){signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new WritingError(413,'ข้อมูลยาวเกินไป กรุณาลดข้อความ');}chunks.push(value);}}finally{signal.removeEventListener('abort',cancelRead);reader.releaseLock();}
    const parsed=writingRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if(!parsed.success)return reply({error:'ตรวจสอบคำขอ API key และโมเดล (คำขอไม่เกิน 8,000 และข้อมูลประกอบไม่เกิน 16,000 ตัวอักษร)'},400);
    const input=parsed.data;
    if(input.action==='models')return reply({models:await listWritingModels(input.apiKey,signal)});
    return reply(await generateWriting(input,signal));
  }catch(error){
    if(error instanceof WritingError)return reply({error:error.message},error.status);
    if(error instanceof SyntaxError)return reply({error:'รูปแบบคำขอไม่ถูกต้อง'},400);
    if(signal.aborted)return reply({error:'ยกเลิกคำขอหรือรอนานเกิน 60 วินาทีแล้ว กรุณาตรวจสอบก่อนกดใหม่'},408);
    return reply({error:'ติดต่อ Gemini ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'},502);
  }finally{controller.abort();}
}
