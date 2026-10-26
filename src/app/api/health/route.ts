/**
 * แผนที่อ่านโค้ด — src/app/api/health/route.ts
 * หน้าที่: ตอบสถานะโปรแกรมและรหัสแยกโฟลเดอร์ที่กำลังรัน เพื่อให้ตัวเปิดไม่พาไปผิด checkout
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../scripts/open-local.mjs
 * 2. ../../../../scripts/run-next.mjs
 * 3. ../../../../next.config.mjs
 * 4. ./route.ts ← คุณอยู่ที่นี่
 * 5. ../../page.tsx
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า next/server — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { NextResponse } from "next/server";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { createHash } from "node:crypto";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
export const dynamic = "force-dynamic";
/* GET: ตอบสถานะโปรแกรมและรหัสแยกโฟลเดอร์ที่กำลังรัน เพื่อให้ตัวเปิดไม่พาไปผิด checkout */
export function GET() {
  const workspaceId = createHash("sha256")
    .update(
      path
        .resolve(
          /* turbopackIgnore: true */ process.env.SARABUN_SOURCE_DIR ||
            process.cwd(),
        )
        .toLowerCase(),
    )
    .digest("hex")
    .slice(0, 16);
  return NextResponse.json(
    {
      status: "ready",
      application: "sarabun",
      workspaceId,
      mode: process.env.NODE_ENV === "production" ? "start" : "dev",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "http://127.0.0.1:3001",
      },
    },
  );
}
