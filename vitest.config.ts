/**
 * แผนที่อ่านโค้ด — vitest.config.ts
 * หน้าที่: กำหนดการทดสอบระดับข้อมูล/ฟังก์ชัน และ alias สำหรับ server-only ในการทดสอบ
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
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { defineConfig } from "vitest/config";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("src"),
      "server-only": path.resolve("tests/server-only.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
