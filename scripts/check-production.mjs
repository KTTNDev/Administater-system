/**
 * แผนที่อ่านโค้ด — scripts/check-production.mjs
 * หน้าที่: ตรวจค่าที่จำเป็นและไฟล์ build ก่อนรันแบบ production โดยไม่พิมพ์รหัสลับ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./open-local.mjs
 * 2. ./run-next.mjs
 * 3. ../next.config.mjs
 * 4. ../src/app/api/health/route.ts
 * 5. ../src/app/page.tsx
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../next.config.mjs
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า ../next.config.mjs — กำหนดโฟลเดอร์ build ขนาด Server Action แพ็กเกจฝั่ง server และ HTTP headers */
import config from "../next.config.mjs";
const workspace = process.cwd();
try {
  process.loadEnvFile(path.join(workspace, ".env.local"));
  if (process.env.SARABUN_LOCAL_DESKTOP !== "true") {
    if ((process.env.APP_PASSWORD || "").length < 12)
      throw new Error(
        "Set APP_PASSWORD to at least 12 characters in .env.local.",
      );
    if ((process.env.SESSION_SECRET || "").length < 32)
      throw new Error(
        "Set SESSION_SECRET to at least 32 characters in .env.local.",
      );
  }
  if (process.env.APP_URL !== "http://127.0.0.1:3000")
    throw new Error(
      "This local launcher requires APP_URL=http://127.0.0.1:3000.",
    );
  if (
    !fs.existsSync(path.join(workspace, config.distDir || ".next", "BUILD_ID"))
  )
    throw new Error("Run npm run build before starting production.");
  console.log("Production configuration is ready.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
