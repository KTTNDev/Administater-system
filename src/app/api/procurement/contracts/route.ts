import {requireUser} from '@/lib/auth';
import {sqliteRepository} from '@/lib/procurement/storage/sqlite';
import {coreContractDates} from '@/lib/procurement/core/contracts';
import {readArchivedProcurementCases} from '@/lib/procurement/core/archive';
import {procurementContractDates} from '@/lib/procurement-contracts';
import {PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
export const runtime='nodejs';
export async function GET(){
  try{await requireUser();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401,headers:PRIVATE_HEADERS});}
  try{
    const dates=[...coreContractDates(sqliteRepository.listCases()),...procurementContractDates(readArchivedProcurementCases())];
    return Response.json({dates},{headers:PRIVATE_HEADERS});
  }catch{return Response.json({error:'เปิดข้อมูลสัญญาไม่สำเร็จ กรุณาตรวจพื้นที่ฐานข้อมูล'},{status:500,headers:PRIVATE_HEADERS});}
}
