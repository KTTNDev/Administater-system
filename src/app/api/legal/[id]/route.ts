/**
 * แผนที่อ่านโค้ด — src/app/api/legal/[id]/route.ts
 * หน้าที่: HTTP GET ส่งไฟล์ PDF จากคลังระเบียบที่ผู้ใช้มีสิทธิ์อ่าน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../components/law-library.tsx
 * 2. ../../../legal-actions.ts
 * 3. ../../../../lib/legal.ts
 * 4. ../../../../lib/db.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../../lib/auth.ts, ../../../../lib/db.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "@/lib/db";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* GET: HTTP GET ส่งไฟล์ PDF จากคลังระเบียบที่ผู้ใช้มีสิทธิ์อ่าน — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success) return new Response("Invalid ID", { status: 400 });
  const row = db()
    .prepare("SELECT file FROM legal_library WHERE id=?")
    .get(parsed.data);
  if (!row?.file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.file as Uint8Array), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        (new URL(_request.url).searchParams.get("inline") === "1"
          ? "inline"
          : "attachment") + "; filename=legal-reference.pdf",
      "Cache-Control": "private, no-store",
    },
  });
}
