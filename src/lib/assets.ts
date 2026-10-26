/**
 * แผนที่อ่านโค้ด — src/lib/assets.ts
 * หน้าที่: อ่านฟอนต์และรูปตราจาก public แล้วแปลงเป็น data URL สำหรับเอกสารที่ไม่พึ่งไฟล์ภายนอก
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
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/page.tsx, ./pdf.ts
 * อ่านต่อจาก import: ./render-document.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า ./render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { DocumentAssets } from "./render-document";
let cached: DocumentAssets | undefined;
/* อ่านฟอนต์/ตราจากไฟล์และทำ data URL; เปลี่ยนรูปต้นฉบับต้องตรวจขนาดและตำแหน่งใน render-document.ts ด้วย */
export function documentAssets(): DocumentAssets {
  const data = (file: string, mime: string) =>
    `data:${mime};base64,${fs.readFileSync(path.join(process.cwd(), "public", file)).toString("base64")}`;
  return (cached ||= {
    regular: data("fonts/THSarabunNew.ttf", "font/ttf"),
    bold: data("fonts/THSarabunNew-Bold.ttf", "font/ttf"),
    garuda: data("assets/garuda.png", "image/png"),
    routingStamp: data("assets/approval-routing-stamp.png", "image/png"),
    copyMark: data("assets/copy-counterpart.png", "image/png"),
  });
}
