/**
 * แผนที่อ่านโค้ด — scripts/download-additional-laws.mjs
 * หน้าที่: ดาวน์โหลดเอกสารอ้างอิงเพิ่มเติมตามรายการที่กำหนดในสคริปต์
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
const dir = "output/legal-research-2026-09-14";
const sources = JSON.parse(
  fs.readFileSync(dir + "/additional-sources.json", "utf8"),
);
for (const row of sources) {
  try {
    const response = await fetch(row.url, {
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.subarray(0, 5).toString() !== "%PDF-" ||
      bytes.length > 10 * 1024 * 1024
    )
      throw new Error("Invalid PDF");
    fs.writeFileSync(dir + "/" + row.file, bytes);
    console.log(JSON.stringify({ file: row.file, bytes: bytes.length }));
  } catch (e) {
    console.log(JSON.stringify({ file: row.file, error: e.message }));
  }
}
