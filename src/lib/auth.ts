/**
 * แผนที่อ่านโค้ด — src/lib/auth.ts
 * หน้าที่: ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ../components/workspace.tsx
 * 3. ./document.ts
 * 4. ../app/actions.ts
 * 5. ./db.ts
 * 6. ./render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ./pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/actions.ts, ../app/api/attachments/[id]/route.ts, ../app/api/budget-references/[id]/route.ts, ../app/api/documents/[id]/pdf/route.ts, ../app/api/google/callback/route.ts, ../app/api/google/connect/route.ts, ../app/api/legal/[id]/route.ts, ../app/api/template-reference/route.ts (และจุดอื่นที่ค้นชื่อ export ได้ใน IDE)
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า next/headers — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { createHash, timingSafeEqual } from "node:crypto";
export const localDemo = () =>
  process.env.NODE_ENV === "development" && process.env.LOCAL_DEMO === "true";
// Opt-in for the single-user launcher, which binds only to 127.0.0.1.
export const localDesktop = () => process.env.SARABUN_LOCAL_DESKTOP === "true";
/* อ่าน SESSION_SECRET จาก environment และตรวจความยาว ห้ามใส่ค่าจริงลงใน source */
export function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("กรุณาตั้ง SESSION_SECRET อย่างน้อย 32 ตัวอักษร");
  return value;
}
/* เทียบ hash ด้วย timingSafeEqual เพื่อลดการรั่วของเวลาเปรียบเทียบรหัสผ่าน */
export function validPassword(value: string) {
  if (!process.env.APP_PASSWORD || process.env.APP_PASSWORD.length < 12)
    return false;
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(value), hash(process.env.APP_PASSWORD));
}
/* ตรวจโหมดที่ได้รับอนุญาตให้ข้ามล็อกอินก่อน จากนั้นตรวจ JWT ใน cookie; boolean ที่คืนไปใช้ทั้งหน้าเว็บและ action */
export async function authenticated() {
  if (localDesktop() || localDemo()) return true;
  const token = (await cookies()).get("sarabun-session")?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret()),
      { issuer: "sarabun", audience: "workspace" },
    );
    return payload.sub === "operator";
  } catch {
    return false;
  }
}
/* หยุดคำสั่งด้วย throw เมื่อไม่ผ่านสิทธิ์ ต้องตรวจใน server แม้ UI จะซ่อนปุ่มแล้ว */
export async function requireUser() {
  if (!(await authenticated())) throw new Error("กรุณาเข้าสู่ระบบใหม่");
}
/* ลงนาม JWT และตั้ง cookie httpOnly/sameSite; cookie ไม่ใช่การเก็บรหัสผ่านผู้ใช้ */
export async function createSession() {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("operator")
    .setIssuer("sarabun")
    .setAudience("workspace")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(secret()));
  (await cookies()).set("sarabun-session", token, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 28800,
  });
}
