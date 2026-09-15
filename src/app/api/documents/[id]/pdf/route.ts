import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { readDraft } from "@/lib/db";
import { renderPdf } from "@/lib/pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await requireUser();} catch {return NextResponse.json({error:"กรุณาเข้าสู่ระบบ"},{status:401});}
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"รหัสไม่ถูกต้อง"},{status:400});
  let draft;try{draft=readDraft(id);}catch{return NextResponse.json({error:"ไม่พบร่างหนังสือ"},{status:404});}
  try {
    const data=await renderPdf(draft);
    return new NextResponse(new Uint8Array(data),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="draft-${id}.pdf"; filename*=UTF-8''${encodeURIComponent(draft.subject+".pdf")}`,"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"สร้าง PDF ไม่สำเร็จ ตรวจการติดตั้ง Chromium และความยาวส่วนหัวของหนังสือ"},{status:500});}
}
