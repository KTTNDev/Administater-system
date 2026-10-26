/**
 * แผนที่อ่านโค้ด — src/app/api/google/connect/route.ts
 * หน้าที่: เริ่ม OAuth: สร้าง state และพาไป Google เพื่อขอสิทธิ์ Drive
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../components/system-center.tsx
 * 2. ../../../storage-actions.ts
 * 3. ../../../../lib/storage.ts
 * 4. ../../../../lib/drive.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../../lib/auth.ts, ../../../../lib/drive.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า next/server — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { NextResponse } from "next/server";
/* นำเข้า next/headers — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { cookies } from "next/headers";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomBytes } from "node:crypto";
/* นำเข้า ../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { oauthClient } from "@/lib/drive";
export const runtime = "nodejs";
/* GET: เริ่ม OAuth: สร้าง state และพาไป Google เพื่อขอสิทธิ์ Drive — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET() {
  try {
    await requireUser();
    const client = oauthClient(),
      state = randomBytes(32).toString("hex");
    (await cookies()).set("google-state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://"),
      maxAge: 600,
      path: "/api/google/callback",
    });
    return NextResponse.redirect(
      client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/drive.file"],
        state,
      }),
    );
  } catch {
    return NextResponse.redirect(
      new URL(
        "/?view=settings&google=setup",
        process.env.APP_URL || "http://127.0.0.1:3000",
      ),
    );
  }
}
