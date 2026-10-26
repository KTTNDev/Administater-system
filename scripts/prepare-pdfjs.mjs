/**
 * แผนที่อ่านโค้ด — scripts/prepare-pdfjs.mjs
 * หน้าที่: เตรียมไฟล์ worker ของ PDF.js ให้ browser เรียกใช้ได้จาก public
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./open-local.mjs
 * 2. ./run-next.mjs
 * 3. ../next.config.mjs
 * 4. ../src/app/api/health/route.ts
 * 5. ../src/app/page.tsx
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
const source = path.resolve("node_modules/pdfjs-dist");
const { version } = JSON.parse(
  fs.readFileSync(path.join(source, "package.json"), "utf8"),
);
const target = path.resolve("public/vendor/pdfjs", version);
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(
  path.join(source, "build/pdf.worker.min.mjs"),
  path.join(target, "pdf.worker.min.mjs"),
);
for (const name of ["cmaps", "standard_fonts", "wasm"])
  fs.cpSync(path.join(source, name), path.join(target, name), {
    recursive: true,
  });
console.log("Prepared local PDF.js assets " + version);
