import 'server-only';
import {buildWritingPrompt,modelNameSchema,writingSystemInstruction,type WritingInput,type WritingModel} from './ai-writing';

const endpoint='https://generativelanguage.googleapis.com/v1beta/';
export class WritingError extends Error {
  constructor(public status:number,message:string){super(message);}
}
async function googleRequest(path:string,apiKey:string,signal:AbortSignal,body?:unknown) {
  const response=await fetch(endpoint+path,{
    method:body?'POST':'GET',cache:'no-store',signal,
    headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  // Never forward upstream error bodies: they can echo request data or credentials.
  if(!response.ok){
    if([400,401,403].includes(response.status))throw new WritingError(400,'ตรวจสอบ API key สิทธิ์ของโมเดล และการเปิดใช้ Gemini API ใน Google AI Studio');
    if(response.status===429)throw new WritingError(429,'โควตา Gemini ไม่พอหรือมีคำขอมากเกินไป ตรวจสอบโควตาก่อนกดใหม่');
    if(response.status===404)throw new WritingError(400,'ไม่พบโมเดลนี้ กรุณาโหลดรายชื่อโมเดลใหม่');
    throw new WritingError(502,'Gemini ยังไม่พร้อมให้บริการ กรุณาลองใหม่ภายหลัง');
  }
  return response.json();
}
export async function listWritingModels(apiKey:string,signal:AbortSignal):Promise<WritingModel[]> {
  const result=new Map<string,WritingModel>();let token='';
  for(let page=0;page<5;page++){
    const query=new URLSearchParams({pageSize:'1000',...(token?{pageToken:token}:{})});
    const data=await googleRequest('models?'+query,apiKey,signal);
    for(const model of Array.isArray(data.models)?data.models:[]){
      if(modelNameSchema.safeParse(model.name).success&&Array.isArray(model.supportedGenerationMethods)&&model.supportedGenerationMethods.includes('generateContent')){
        result.set(model.name,{name:model.name,displayName:typeof model.displayName==='string'?model.displayName.slice(0,128):model.name});
      }
    }
    token=typeof data.nextPageToken==='string'?data.nextPageToken:'';if(!token)break;
  }
  return [...result.values()];
}
export async function generateWriting(input:WritingInput&{apiKey:string;model:string},signal:AbortSignal) {
  const model=modelNameSchema.parse(input.model);
  const data=await googleRequest(model+':generateContent',input.apiKey,signal,{
    systemInstruction:{parts:[{text:writingSystemInstruction}]},
    contents:[{role:'user',parts:[{text:buildWritingPrompt(input)}]}],
    generationConfig:{maxOutputTokens:4096},
  });
  const candidate=data.candidates?.[0];
  if(data.promptFeedback?.blockReason||!candidate||!['STOP','MAX_TOKENS'].includes(candidate.finishReason)){
    throw new WritingError(422,'Gemini ไม่ได้ส่งคำตอบที่สมบูรณ์ กรุณาปรับคำขอหรือข้อมูลประกอบ');
  }
  const text=(Array.isArray(candidate.content?.parts)?candidate.content.parts:[])
    .filter((part:{text?:unknown;thought?:boolean})=>!part.thought&&typeof part.text==='string')
    .map((part:{text:string})=>part.text).join('').trim();
  if(!text)throw new WritingError(422,'Gemini ไม่ได้ส่งข้อความกลับมา กรุณาปรับคำขอ');
  return {text:text.slice(0,30000),truncated:candidate.finishReason==='MAX_TOKENS'||text.length>30000};
}
