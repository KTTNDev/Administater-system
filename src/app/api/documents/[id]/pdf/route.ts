/**
 * แผนที่อ่านโค้ด — src/app/api/documents/[id]/pdf/route.ts
 * หน้าที่: HTTP GET สำหรับดาวน์โหลด PDF ของร่างตาม id ตรวจสิทธิ์และรหัสก่อนอ่านฐานข้อมูล
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../page.tsx
 * 2. ../../../../../components/workspace.tsx
 * 3. ../../../../../lib/document.ts
 * 4. ../../../../actions.ts
 * 5. ../../../../../lib/db.ts
 * 6. ../../../../../lib/render-document.ts
 * 7. ./route.ts ← คุณอยู่ที่นี่
 * 8. ../../../../../lib/pdf.ts
 * อ่านต่อจาก import: ../../../../../lib/auth.ts, ../../../../../lib/db.ts, ../../../../../lib/pdf.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า next/server — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { NextResponse } from "next/server";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ../../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { readDraft } from "@/lib/db";
/* นำเข้า ../../../../../lib/pdf.ts — เปิด HTML เอกสารด้วย Chromium แบบไม่แสดงหน้าต่าง รอจัดหน้า แล้วรวมไฟล์แนบเป็น PDF */
import { renderPdf } from "@/lib/pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* GET: HTTP GET สำหรับดาวน์โหลด PDF ของร่างตาม id ตรวจสิทธิ์และรหัสก่อนอ่านฐานข้อมูล — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
  let draft;
  try {
    draft = readDraft(id);
  } catch {
    return NextResponse.json({ error: "ไม่พบร่างหนังสือ" }, { status: 404 });
  }
  try {
    const data = await renderPdf(draft);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="draft-${id}.pdf"; filename*=UTF-8''${encodeURIComponent(draft.subject + ".pdf")}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "สร้าง PDF ไม่สำเร็จ ตรวจการติดตั้ง Chromium และความยาวส่วนหัวของหนังสือ",
      },
      { status: 500 },
    );
  }
}
