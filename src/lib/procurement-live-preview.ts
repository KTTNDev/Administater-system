import 'server-only';
import {createHash} from 'node:crypto';
import {procurementSchema,d01Values,d07Values,procurementBindings,type ProcurementInput} from './procurement';
import {documentTemplates,type DraftDocumentCode} from './procurement-documents';
import {procurementTemplateBytes} from './procurement-db';
import {replaceTemplateText,linkContinuationFooter} from './procurement-template';
import {finalizeProcurementWord} from './procurement-preview';
import {finishSuiteDocument} from './procurement-suite';
type Preview={id:string;state:'queued'|'rendering'|'ready'|'superseded'|'error';at:number;code:DraftDocumentCode;word:Buffer;pdf?:Buffer;pages?:number;error?:string};
type QueueState={jobs:Map<string,Preview>;pending:Map<string,string>;running:boolean};
const globalPreview=globalThis as unknown as {procurementLivePreview?:QueueState;procurementNativePreviewBusy?:boolean};
const state=()=>globalPreview.procurementLivePreview??={jobs:new Map(),pending:new Map(),running:false};
async function buildUncachedPreview(data:ProcurementInput,code:DraftDocumentCode){
 const template=documentTemplates[code],reference=procurementTemplateBytes(code);if(createHash('sha256').update(reference).digest('hex')!==template.sha256)throw Error('แม่แบบเปลี่ยน กรุณาตรวจต้นฉบับ');
 const values=code==='D01'?d01Values(data):d07Values(data),changes=template.slots.flatMap(slot=>slot.targets.map(target=>{
  let value=(values[slot.key]||'').replace(/\{\{([a-zA-Z]+)\}\}/g,(_,name)=>'['+(procurementBindings[name as keyof typeof procurementBindings]||name)+']');
  if(!value.trim()&&!['secretaryActing','authorityActing','approval2','approval3','approval4'].includes(slot.key))value=['day','month','year'].includes(slot.key)?'…':slot.key==='offered'||slot.key==='agreed'?'—':'['+slot.label.replace(/ D0[17]$/,'')+']';
  return {p:target.p,nodes:target.nodes,text:target.parentheses?'('+value+')':value?(target.prefix||'')+value:''};
 }));
 if(code==='D07'){
  const valid=/^\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?$/.test(values.agreed||'');let net='—',vat='—';
  if(valid){const [a,b='']=values.agreed.replaceAll(',','').split('.'),gross=BigInt(a)*100n+BigInt(b.padEnd(2,'0')),base=(gross*100n+53n)/107n;const money=(value:bigint)=>{const s=value.toString().padStart(3,'0');return s.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+s.slice(-2);};net=money(base);vat=money(gross-base);}
  changes.push({p:15,nodes:undefined,text:net},{p:17,nodes:undefined,text:vat});
 }
 const built=await replaceTemplateText(reference,changes);
 // A partial preview may span pages; never show the unrelated footer retained in the old sample.
 return (await finishSuiteDocument(built.bytes,data,code)).bytes;
}
const wordCache=new Map<string,Promise<Buffer>>();
export async function buildLivePreview(data:ProcurementInput,code:DraftDocumentCode){
 const references=Object.entries(data.documents).filter(([,v])=>v&&(v.number||v.date||v.subject||Object.keys(v.paragraphs).length)).map(([key,v])=>[key,{number:v?.number,date:v?.date,subject:v?.subject,paragraphs:v?.paragraphs}]);
 const key=createHash('sha256').update(procurementTemplateBytes(code)).update(code+documentTemplates[code].outputVersion).update(JSON.stringify({wordingMode:data.wordingMode,common:data.common,bill:data.bill,kind:data.kind,d01:data.d01,d01Overrides:data.d01Overrides,d07Overrides:data.d07Overrides,inspection:data.inspection,contractDue:data.contractDue,references})).digest('hex');
 let result=wordCache.get(key);if(!result){if(wordCache.size>=50)wordCache.delete(wordCache.keys().next().value!);result=buildUncachedPreview(data,code);wordCache.set(key,result);result.catch(()=>wordCache.delete(key));}return result;
}
const result=(job:Preview)=>({id:job.id,state:job.state,code:job.code,pages:job.pages,error:job.error,url:job.state==='ready'?'/api/procurement/live/'+job.id+'/pdf':undefined});
export async function requestLivePreview(input:unknown,code:DraftDocumentCode,client:string){
 const data=procurementSchema.parse({...input as object,title:(input as {title?:string})?.title||'ตัวอย่างที่ยังไม่บันทึก'}),word=await buildLivePreview(data,code),id=createHash('sha256').update(word).update(documentTemplates[code].outputVersion).digest('hex'),s=state();
 for(const [key,job] of s.jobs)if(Date.now()-job.at>10*60*1000&&job.state!=='rendering')s.jobs.delete(key);
 const key=client+':'+code,previous=s.pending.get(key);if(previous&&previous!==id){const old=s.jobs.get(previous);if(old&&old.state==='queued')old.state='superseded';s.pending.delete(key);}
 const existing=s.jobs.get(id);if(existing&&existing.state!=='superseded'&&existing.state!=='error')return result(existing);
 if(s.jobs.size>80){for(const [key,job] of s.jobs)if(job.state!=='rendering'&&job.state!=='queued'){s.jobs.delete(key);if(s.jobs.size<50)break;}}
 const job:Preview={id,state:'queued',word,code,at:Date.now()};s.jobs.set(id,job);s.pending.set(key,id);void runQueue();return result(job);
}
async function runQueue(){
 const s=state();if(s.running)return;s.running=true;
 try{while(s.pending.size){const [key,id]=s.pending.entries().next().value!;s.pending.delete(key);const job=s.jobs.get(id);if(!job||job.state!=='queued')continue;job.state='rendering';
  try{const start=Date.now();while(globalPreview.procurementNativePreviewBusy){if(Date.now()-start>90000)throw Error('รอจัดหน้าไม่สำเร็จ โปรดลองใหม่');await new Promise(resolve=>setTimeout(resolve,500));}const rendered=await finalizeProcurementWord(job.word);job.pdf=rendered.bytes;job.pages=rendered.pages;job.state='ready';job.at=Date.now();}
  catch(error){job.state='error';job.error=error instanceof Error?error.message:'จัดหน้าไม่สำเร็จ';}
 }}finally{s.running=false;}
}
export function livePreviewStatus(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error('รหัสตัวอย่างไม่ถูกต้อง');const job=state().jobs.get(id);if(!job)throw Error('ตัวอย่างหมดอายุ กรุณาแก้ข้อมูลหรือโหลดตัวอย่างอีกครั้ง');return result(job);}
export function livePreviewPdf(id:string){livePreviewStatus(id);const job=state().jobs.get(id)!;if(job.state!=='ready'||!job.pdf)throw Error('กำลังจัดตัวอย่าง');return job.pdf;}
