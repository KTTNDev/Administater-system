import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {sqliteRepository,ConflictError} from '@/lib/procurement/storage/sqlite';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
export const runtime='nodejs';
export async function GET(request:Request){try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401,headers:PRIVATE_HEADERS});}try{const action=new URL(request.url).searchParams.get('action');const result=action==='list'?sqliteRepository.listCases():action==='master'?sqliteRepository.getMasterData():action==='registry'?sqliteRepository.getNumberingRegistry():null;return result===null?Response.json({error:'ไม่พบรายการ'},{status:404,headers:PRIVATE_HEADERS}):Response.json(result,{headers:PRIVATE_HEADERS});}catch(e){console.error('[procurement/workspace GET]',e);return Response.json({error:'เปิดข้อมูลจัดซื้อจัดจ้างไม่สำเร็จ กรุณาตรวจพื้นที่ฐานข้อมูล'},{status:500,headers:PRIVATE_HEADERS});}}
export async function POST(request:Request){try{await guardExportRequest(request);const {action,payload}=z.object({action:z.enum(['save','delete','saveMaster','advance']),payload:z.unknown()}).parse(await readExportJson(request));let result:unknown;
  if(action==='save')result=sqliteRepository.saveCase(payload as Parameters<typeof sqliteRepository.saveCase>[0]);
  if(action==='saveMaster'){const record=z.object({data:z.unknown(),version:z.number().int().nonnegative()}).parse(payload);result=sqliteRepository.saveMasterData(record as Parameters<typeof sqliteRepository.saveMasterData>[0]);}
  if(action==='advance')result=sqliteRepository.advanceNumberingRegistry(payload);
  if(action==='delete'){const {id,version}=z.object({id:z.string().min(1),version:z.number().int().positive()}).parse(payload);sqliteRepository.deleteCase(id,version);result={ok:true};}
  return Response.json(result,{headers:PRIVATE_HEADERS});
}catch(e){if(e instanceof ConflictError)return Response.json({error:e.message},{status:409,headers:PRIVATE_HEADERS});return exportFailure(e);}}
