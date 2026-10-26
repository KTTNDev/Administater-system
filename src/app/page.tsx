/**
 * แผนที่อ่านโค้ด — src/app/page.tsx
 * หน้าที่: จุดเข้า URL /: ตรวจสิทธิ์ อ่านข้อมูลเริ่มต้นจากเซิร์ฟเวอร์ แล้วส่ง props ให้ Workspace
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./page.tsx ← คุณอยู่ที่นี่
 * 2. ../components/workspace.tsx
 * 3. ../lib/document.ts
 * 4. ./actions.ts
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ./api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/db.ts, ../lib/drive.ts, ../lib/assets.ts, ../components/workspace.tsx, ../lib/office-db.ts, ../lib/booking-db.ts, ../lib/calendar-db.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า next/navigation — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { redirect } from "next/navigation";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { authenticated, localDemo } from "@/lib/auth";
/* นำเข้า ../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { listDrafts, getSetting } from "@/lib/db";
/* นำเข้า ../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { driveStatus } from "@/lib/drive";
/* นำเข้า ../lib/assets.ts — อ่านฟอนต์และรูปตราจาก public แล้วแปลงเป็น data URL สำหรับเอกสารที่ไม่พึ่งไฟล์ภายนอก */
import { documentAssets } from "@/lib/assets";
/* นำเข้า ../components/workspace.tsx — ศูนย์ควบคุมหน้าจอและร่างปัจจุบัน เชื่อมช่องกรอก การบันทึก ตัวอย่าง A4 และปุ่มส่งออก */
import { Workspace } from "@/components/workspace";
/* นำเข้า ../lib/office-db.ts — อ่านเขียนทะเบียนงานธุรการ ตรวจร่างหนังสืออ้างอิงและ version ก่อนแก้ไข */
import { listOffice } from "@/lib/office-db";
/* นำเข้า ../lib/booking-db.ts — เก็บห้องและการจอง มี transaction และ trigger ป้องกันการจองซ้อนถึงระดับ SQLite */
import { bookingSnapshot } from "@/lib/booking-db";
/* นำเข้า ../lib/calendar-db.ts — เก็บนัดหมายและตรวจเอกสาร/งานธุรการที่เชื่อมโยงก่อนบันทึก */
import { listCalendar } from "@/lib/calendar-db";
/* Next.js อ่าน export นี้เพื่อ render หน้าใหม่ตาม request เพราะข้อมูลร่าง/สิทธิ์เป็นข้อมูลของผู้ใช้ ไม่ใช่หน้า static ตอน build */
export const dynamic = "force-dynamic";
/* ต้องใช้ Node.js เพราะ SQLite และการอ่านไฟล์ในระบบใช้ API ของ Node ไม่รองรับ Edge runtime */
export const runtime = "nodejs";
/* ทำงานบน server ทุกครั้งที่เข้าหน้า อ่าน searchParams แบบ Promise แล้วส่งข้อมูลเริ่มต้นให้ client component */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; google?: string }>;
}) {
  /* ยืนยันสิทธิ์ก่อนอ่านข้อมูลธุรกิจ หากไม่ผ่าน redirect จะหยุดการ render นี้และพาไป /login */
  if (!(await authenticated())) redirect("/login");
  /* รอผลของงานก่อนกำหนด params; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
  const params = await searchParams;
  return (
    <Workspace
      initialCalendar={listCalendar()}
      initialBookings={bookingSnapshot()}
      initialOffice={listOffice()}
      initialDocuments={listDrafts()}
      assets={documentAssets()}
      drive={driveStatus()}
      local={localDemo()}
      initialView={params.view}
      googleResult={params.google}
      savedOrganization={
        getSetting("organization")
          ? JSON.parse(getSetting("organization")!)
          : null
      }
    />
  );
}
