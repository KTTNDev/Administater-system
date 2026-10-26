/**
 * แผนที่อ่านโค้ด — src/app/api/google/callback/route.ts
 * หน้าที่: รับผล OAuth ตรวจ state แลก token และจัดเก็บก่อนพากลับหน้าระบบ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../../../components/system-center.tsx
 * 2. ../../../storage-actions.ts
 * 3. ../../../../lib/storage.ts
 * 4. ../../../../lib/drive.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../../../lib/auth.ts, ../../../../lib/drive.ts, ../../../../lib/db.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า next/server — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { NextRequest, NextResponse } from "next/server";
/* นำเข้า next/headers — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { cookies } from "next/headers";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { timingSafeEqual } from "node:crypto";
import { drive as createDrive } from "@googleapis/drive";
/* นำเข้า ../../../../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../../../../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { oauthClient, encrypt } from "@/lib/drive";
/* นำเข้า ../../../../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, setSetting } from "@/lib/db";
export const runtime = "nodejs";
/* GET: รับผล OAuth ตรวจ state แลก token และจัดเก็บก่อนพากลับหน้าระบบ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function GET(request: NextRequest) {
  const origin = process.env.APP_URL || "http://127.0.0.1:3000";
  try {
    await requireUser();
    const jar = await cookies(),
      stored = jar.get("google-state")?.value,
      state = request.nextUrl.searchParams.get("state"),
      code = request.nextUrl.searchParams.get("code");
    jar.set("google-state", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/google/callback",
      maxAge: 0,
      secure: process.env.APP_URL?.startsWith("https://"),
    });
    if (
      !stored ||
      !state ||
      stored.length !== state.length ||
      !timingSafeEqual(Buffer.from(stored), Buffer.from(state)) ||
      !code
    )
      throw new Error("Invalid OAuth state");
    const auth = oauthClient(),
      { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token) throw new Error("Missing refresh token");
    auth.setCredentials(tokens);
    const { data } = await createDrive({ version: "v3", auth }).about.get({
      fields: "user(emailAddress,permissionId)",
    });
    db().transaction(() => {
      db().prepare("DELETE FROM settings WHERE key LIKE 'drive:%'").run();
      setSetting("google:token", encrypt(tokens.refresh_token!));
      setSetting("google:email", data.user?.emailAddress || "");
      setSetting("google:account", data.user?.permissionId || "");
    })();
    return NextResponse.redirect(
      new URL("/?view=settings&google=connected", origin),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/?view=settings&google=error", origin),
    );
  }
}
