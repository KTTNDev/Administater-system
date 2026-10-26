/**
 * แผนที่อ่านโค้ด — src/app/api/attachments/[id]/route.ts
 * หน้าที่: HTTP GET อ่านไฟล์แนบตาม id รวมตัวเลือกดาวน์โหลดต้นฉบับ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../lib/document.ts
 * 2. ../../../../components/attachment-editor.tsx
 * 3. ../../../attachment-actions.ts
 * 4. ../../../../lib/attachments.ts
 * 5. ../../../../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../../lib/auth.ts, ../../../../lib/attachments.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../lib/attachments.ts — รับ PDF/ภาพ ตรวจเนื้อไฟล์ เก็บต้นฉบับและฉบับสำหรับพิมพ์ แล้วรวมท้าย PDF ของหนังสือ */
import { readAttachment } from "@/lib/attachments";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
export const runtime = "nodejs";
/* GET: HTTP GET อ่านไฟล์แนบตาม id รวมตัวเลือกดาวน์โหลดต้นฉบับ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new Response("Invalid ID", { status: 400 });
  try {
    const item = readAttachment(id);
    if (
      new URL(request.url).searchParams.get("original") === "1" &&
      item.original
    )
      return new Response(new Uint8Array(item.original), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="original"; filename*=UTF-8''${encodeURIComponent(item.originalName || "original")}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    return new Response(new Uint8Array(item.file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="attachment.pdf"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
