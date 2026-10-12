import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { readDraft } from '@/lib/db';
import { renderWord } from '@/lib/word';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await requireUser();} catch {return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});}
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'รหัสไม่ถูกต้อง'},{status:400});
  let draft;try {draft=readDraft(id);} catch {return NextResponse.json({error:'ไม่พบร่างหนังสือ'},{status:404});}
  try {
    const data=await renderWord(draft);
    return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="draft-${id}.docx"; filename*=UTF-8''${encodeURIComponent(draft.subject+'.docx')}`,'Cache-Control':'private, no-store'}});
  } catch(error) {
    console.error('Word export failed',error);
    const message=error instanceof Error&&/^(มีเนื้อหา|Word รองรับ|ข้อมูล.*ไม่ตรง|ไม่พบ.*กรุณา)/.test(error.message)?error.message:'สร้าง Word ไม่สำเร็จ กรุณาตรวจตัวอย่างและลองอีกครั้ง';
    return NextResponse.json({error:message},{status:500});
  }
}
