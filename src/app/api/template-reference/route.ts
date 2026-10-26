/**
 * แผนที่อ่านโค้ด — src/app/api/template-reference/route.ts
 * หน้าที่: HTTP GET ส่ง PDF แบบอ้างอิงเอกสารจากไฟล์ในเครื่อง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../page.tsx
 * 2. ../../../components/workspace.tsx
 * 3. ../../../lib/document.ts
 * 4. ../../actions.ts
 * 5. ../../../lib/db.ts
 * 6. ../../../lib/render-document.ts
 * 7. ../documents/[id]/pdf/route.ts
 * 8. ../../../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../lib/auth.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { authenticated } from "@/lib/auth";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
export const runtime = "nodejs";
/* GET: HTTP GET ส่ง PDF แบบอ้างอิงเอกสารจากไฟล์ในเครื่อง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET() {
  if (!(await authenticated()))
    return new Response("Unauthorized", { status: 401 });
  const file = path.join(
    process.env.SARABUN_SOURCE_DIR || process.cwd(),
    "data/template-references/20170502100402.pdf",
  );
  if (!fs.existsSync(file))
    return new Response("Reference not installed", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="20170502100402.pdf"',
    },
  });
}
