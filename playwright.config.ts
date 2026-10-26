/**
 * แผนที่อ่านโค้ด — playwright.config.ts
 * หน้าที่: กำหนด browser URL และการเก็บหลักฐานของการทดสอบแบบใช้หน้าจอจริง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./src/app/page.tsx
 * 2. ./src/components/workspace.tsx
 * 3. ./src/lib/document.ts
 * 4. ./src/app/actions.ts
 * 5. ./src/lib/db.ts
 * 6. ./src/lib/render-document.ts
 * 7. ./src/app/api/documents/[id]/pdf/route.ts
 * 8. ./src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { defineConfig } from "@playwright/test";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
const executablePath =
  process.env.CHROMIUM_EXECUTABLE_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => fs.existsSync(p));
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath },
    screenshot: "only-on-failure",
  },
});
