"use server";
/**
 * แผนที่อ่านโค้ด — src/app/setup-actions.ts
 * หน้าที่: ตรวจความพร้อมการตั้งค่าฝั่งเซิร์ฟเวอร์ โดยส่งกลับสถานะ ไม่ส่งรหัสลับไป UI
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./page.tsx
 * 2. ../components/workspace.tsx
 * 3. ../lib/document.ts
 * 4. ./actions.ts
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ./api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/setup-readiness.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/drive.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { driveStatus } from "@/lib/drive";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* getSetupReadiness: ตรวจความพร้อมการตั้งค่าฝั่งเซิร์ฟเวอร์ โดยส่งกลับสถานะ ไม่ส่งรหัสลับไป UI — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getSetupReadiness() {
  await requireUser();
  const root = process.env.SARABUN_SOURCE_DIR || process.cwd();
  return {
    passwordReady: (process.env.APP_PASSWORD || "").length >= 12,
    secretReady: (process.env.SESSION_SECRET || "").length >= 32,
    production: process.env.NODE_ENV === "production",
    drive: driveStatus(),
    callback:
      (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "") +
      "/api/google/callback",
    setupPath: path.join(root, "Setup-Sarabun-Production.cmd"),
    launcherPath: path.join(root, "Open-Sarabun-Production.cmd"),
  };
}
