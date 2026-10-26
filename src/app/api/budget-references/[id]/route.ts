/**
 * แผนที่อ่านโค้ด — src/app/api/budget-references/[id]/route.ts
 * หน้าที่: HTTP GET อ่าน PDF อ้างอิงงบประมาณตามรหัสที่รองรับ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../lib/budget.ts
 * 2. ../../../../components/budget-transfers.tsx
 * 3. ../../../budget-actions.ts
 * 4. ../../../../lib/budget-db.ts
 * 5. ../../../../lib/budget-document.ts
 * 6. ../../../../lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../../lib/auth.ts, ../../../../lib/budget-references.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../lib/budget-references.ts — ข้อมูลและตัวช่วยอ้างเกณฑ์ราคามาตรฐาน/จำแนกงบประมาณที่เลือกประกอบคำขอ */
import { referenceSources } from "@/lib/budget-references";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
export const runtime = "nodejs";
/* GET: HTTP GET อ่าน PDF อ้างอิงงบประมาณตามรหัสที่รองรับ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  if (!Object.hasOwn(referenceSources, id))
    return new Response("Not found", { status: 404 });
  const file = path.join(
    process.env.SARABUN_SOURCE_DIR || process.cwd(),
    "data",
    "budget-references",
    id + ".pdf",
  );
  if (!fs.existsSync(file))
    return new Response("Reference PDF unavailable", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
