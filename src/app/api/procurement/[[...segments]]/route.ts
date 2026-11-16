import {NextRequest} from 'next/server';
import {requireUser} from '@/lib/auth';
import {z} from 'zod';
import {attachProcurementFile,generateProcurementDocument,generateProcurementSuite,installProcurementTemplate,procurementHistory,procurementSnapshot,ProcurementConflict,previewProcurementD07,readProcurementFile,readProcurement,saveProcurement} from '@/lib/procurement-db';
import {procurementPreset} from '@/lib/procurement-presets';
import {requestLivePreview,livePreviewStatus,livePreviewPdf} from '@/lib/procurement-live-preview';
import {suiteCodes} from '@/lib/procurement-workflow-model';
import {reviewProcurementDocument,transitionProcurement,documentChecklist} from '@/lib/procurement-process';
import {procurementSuiteZip,procurementPacketZip,procurementPacketPdf,procurementSuitePdf,procurementFilePdf} from '@/lib/procurement-bundle';
import {suiteParagraphs,suiteValues,resolveSuiteText,suiteMissing} from '@/lib/procurement-suite';
import {procurementSchema,procurementCodes} from '@/lib/procurement';
import {procurementJourney} from '@/lib/procurement-journey';
import {procurementJourneyProgress,advanceProcurementJourney,prepareProcurementJourneyDocument,attachProcurementJourneyFile,reviewProcurementJourneyDocument} from '@/lib/procurement-journey-server';
import {compareProcurementWord} from '@/lib/procurement-roundtrip';
import {procurementContractDates} from '@/lib/procurement-contracts';
import {procurementBundleName,procurementDownloadHeader} from '@/lib/procurement-filenames';
import {procurementPacket} from '@/lib/procurement-bundle';

export const runtime='nodejs';
const noCache={'Cache-Control':'private, no-store'};
type Context={params:Promise<{segments?:string[]}>};
async function guard(request:NextRequest,write=false){
 await requireUser();
 if(write){const origin=request.headers.get('origin'),host=request.headers.get('host');if(!origin||!host||new URL(origin).host!==host||new URL(origin).protocol!==request.nextUrl.protocol)throw Error('ไม่อนุญาตคำขอจากเว็บไซต์อื่น');}
}
async function limitedBody(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw Error('ข้อมูลมีขนาดใหญ่เกินกำหนด');
 const reader=request.body?.getReader();if(!reader)throw Error('ไม่พบข้อมูล');let length=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw Error('ข้อมูลมีขนาดใหญ่เกินกำหนด');}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks);
}
function failure(error:unknown){return Response.json({error:error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):error instanceof Error?error.message:'ดำเนินการไม่สำเร็จ'},{status:error instanceof ProcurementConflict?409:400,headers:noCache});}
export async function GET(request:NextRequest,{params}:Context){
 try{
  await guard(request);const segments=(await params).segments||[];
  if(!segments.length)return Response.json(procurementSnapshot(),{headers:noCache});
  if(segments[0]==='contracts'&&segments.length===1)return Response.json({dates:procurementContractDates(procurementSnapshot().cases)},{headers:noCache});
  if(segments[0]==='journey'&&segments.length===2)return Response.json(await procurementJourneyProgress(segments[1]),{headers:noCache});
  if(segments[0]==='presets'&&segments.length===1)return Response.json(await procurementPreset(z.enum(['purchase','hire']).parse(request.nextUrl.searchParams.get('kind')||'purchase')),{headers:noCache});
  if(segments[0]==='live'&&segments.length===2)return Response.json(livePreviewStatus(segments[1]),{headers:noCache});
  if(segments[0]==='live'&&segments.length===3&&segments[2]==='pdf')return new Response(new Uint8Array(livePreviewPdf(segments[1])),{headers:{...noCache,'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff'}});
  if(segments[0]==='history'&&segments.length===2)return Response.json(procurementHistory(segments[1]),{headers:noCache});
  if(segments[0]==='file-preview'&&segments.length===2)return new Response(new Uint8Array(await procurementFilePdf(segments[1])),{headers:{...noCache,'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff'}});
  if(segments[0]==='checklist'&&segments.length===2){const current=readProcurement(segments[1]),files=procurementSnapshot().files.filter(f=>f.caseId===current.id);return Response.json({first:await documentChecklist(current,files),second:await documentChecklist(current,files,2)},{headers:noCache});}
  if(segments[0]==='suite'&&segments.length===2)return new Response(new Uint8Array(await procurementSuiteZip(segments[1])),{headers:{...noCache,'Content-Type':'application/zip','Content-Disposition':procurementDownloadHeader(procurementBundleName(readProcurement(segments[1]),'zip'))}});
  if(segments[0]==='packets'&&segments.length===3)return new Response(new Uint8Array(await procurementPacketZip(segments[1],segments[2])),{headers:{...noCache,'Content-Type':'application/zip','Content-Disposition':procurementDownloadHeader(procurementBundleName(readProcurement(segments[1]),'zip',procurementPacket(segments[1],segments[2]).round))}});
  if(segments[0]==='files'&&segments.length===2){const file=readProcurementFile(segments[1]);return new Response(new Uint8Array(file.bytes),{headers:{...noCache,'Content-Type':file.mime,'Content-Disposition':`${request.nextUrl.searchParams.get('download')==='1'?'attachment':'inline'}; filename="document.${file.name.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff'}});}
  return Response.json({error:'ไม่พบรายการ'},{status:404,headers:noCache});
 }catch(error){return failure(error);}
}
export async function POST(request:NextRequest,{params}:Context){
 try{
  await guard(request,true);const segments=(await params).segments||[];
  if(segments[0]==='stage-file'&&segments.length===2){
   const version=z.coerce.number().int().positive().parse(request.nextUrl.searchParams.get('version')),code=z.enum(procurementCodes).parse(request.nextUrl.searchParams.get('code')),kind=z.enum(['primary','signed']).parse(request.nextUrl.searchParams.get('kind'));
   return Response.json(await attachProcurementJourneyFile(segments[1],version,code,kind,await limitedBody(request,20*1024*1024),decodeURIComponent(request.headers.get('x-file-name')||'')),{headers:noCache});
  }
  if(segments[0]==='template'&&segments.length===1){const code=z.enum(suiteCodes).parse(request.nextUrl.searchParams.get('code')||'D07'),bytes=await limitedBody(request,1024*1024);installProcurementTemplate(bytes,decodeURIComponent(request.headers.get('x-file-name')||code+'.docx'),code);return Response.json({ok:true},{headers:noCache});}
  if(segments[0]==='compare'&&segments.length===2){const baseId=z.string().uuid().parse(request.nextUrl.searchParams.get('base'));return Response.json(await compareProcurementWord(segments[1],baseId,await limitedBody(request,20*1024*1024),decodeURIComponent(request.headers.get('x-file-name')||'')),{headers:noCache});}
  if(segments[0]==='attachments'&&segments.length===2){
   const version=z.coerce.number().int().positive().parse(request.nextUrl.searchParams.get('version'));
   const meta={code:request.nextUrl.searchParams.get('code'),origin:request.nextUrl.searchParams.get('origin'),caseVersion:null};
   const id=await attachProcurementFile(segments[1],version,await limitedBody(request,20*1024*1024),decodeURIComponent(request.headers.get('x-file-name')||''),meta);return Response.json({id},{headers:noCache});
  }
  const input=JSON.parse((await limitedBody(request,4*1024*1024)).toString());
  if(segments[0]==='stage-review'&&segments.length===2){const parsed=z.object({version:z.number().int().positive(),code:z.enum(procurementCodes)}).strict().parse(input);return Response.json(await reviewProcurementJourneyDocument(segments[1],parsed.version,parsed.code),{headers:noCache});}
  if(segments[0]==='advance'&&segments.length===2){const parsed=z.object({version:z.number().int().positive(),stage:z.enum(procurementJourney.map(s=>s.id))}).strict().parse(input);return Response.json(await advanceProcurementJourney(segments[1],parsed.version,parsed.stage),{headers:noCache});}
  if(segments[0]==='prepare-stage'&&segments.length===2){const parsed=z.object({version:z.number().int().positive(),code:z.enum(suiteCodes)}).strict().parse(input);return Response.json(await prepareProcurementJourneyDocument(segments[1],parsed.version,parsed.code),{headers:noCache});}
  if(segments[0]==='live'&&segments.length===1){const parsed=z.object({data:z.unknown(),code:z.enum(suiteCodes),client:z.string().uuid()}).strict().parse(input);return Response.json(await requestLivePreview(parsed.data,parsed.code,parsed.client),{headers:noCache});}
  if(segments[0]==='wording'&&segments.length===1){const parsed=z.object({data:z.unknown(),code:z.enum(suiteCodes)}).strict().parse(input),data=procurementSchema.parse(parsed.data),values=suiteValues(data,parsed.code),paragraphs=await suiteParagraphs(parsed.code);return Response.json({paragraphs:paragraphs.map(p=>({...p,current:resolveSuiteText(data.documents[parsed.code]?.paragraphs[String(p.p)]??p.template,values,true)})),missing:await suiteMissing(data,parsed.code)},{headers:noCache});}
  if(!segments.length){const parsed=z.object({data:z.unknown(),id:z.string().uuid().optional(),version:z.number().int().positive().optional()}).strict().parse(input);return Response.json(saveProcurement(parsed.data,parsed.id,parsed.version),{headers:noCache});}
  if(segments[0]==='generate'&&segments.length===2){const {version}=z.object({version:z.number().int().positive()}).strict().parse(input);return Response.json({id:await generateProcurementDocument(segments[1],version,z.enum(suiteCodes).parse(request.nextUrl.searchParams.get('code')||'D07'))},{headers:noCache});}
  if(segments[0]==='generate-suite'&&segments.length===2){const {version}=z.object({version:z.number().int().positive()}).strict().parse(input);return Response.json(await generateProcurementSuite(segments[1],version),{headers:noCache});}
  if(segments[0]==='review'&&segments.length===2){const {version,code}=z.object({version:z.number().int().positive(),code:z.enum([...suiteCodes,'E01','V01','P01','OTHER'])}).strict().parse(input);return Response.json(await reviewProcurementDocument(segments[1],version,{code}),{headers:noCache});}
  if(segments[0]==='process'&&segments.length===2){const parsed=z.object({version:z.number().int().positive(),event:z.unknown()}).strict().parse(input);return Response.json(await transitionProcurement(segments[1],parsed.version,parsed.event),{headers:noCache});}
  if(segments[0]==='print-packet'&&segments.length===3){z.object({}).strict().parse(input);return new Response(new Uint8Array(await procurementPacketPdf(segments[1],segments[2])),{headers:{...noCache,'Content-Type':'application/pdf','Content-Disposition':procurementDownloadHeader(procurementBundleName(readProcurement(segments[1]),'pdf',procurementPacket(segments[1],segments[2]).round))}});}
  if(segments[0]==='print-suite'&&segments.length===2){const {version}=z.object({version:z.number().int().positive()}).strict().parse(input);return new Response(new Uint8Array(await procurementSuitePdf(segments[1],version)),{headers:{...noCache,'Content-Type':'application/pdf','Content-Disposition':procurementDownloadHeader(procurementBundleName(readProcurement(segments[1]),'pdf'))}});}
  if(segments[0]==='preview'&&segments.length===2){z.object({}).strict().parse(input);return Response.json(await previewProcurementD07(segments[1]),{headers:noCache});}
  return Response.json({error:'ไม่พบรายการ'},{status:404,headers:noCache});
 }catch(error){return failure(error);}
}
