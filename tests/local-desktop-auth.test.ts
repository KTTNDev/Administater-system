/**
 * แผนที่อ่านโค้ด — tests/local-desktop-auth.test.ts
 * หน้าที่: กรณีทดสอบ local-desktop-auth; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/app/page.tsx
 * 2. ../src/components/workspace.tsx
 * 3. ../src/lib/document.ts
 * 4. ../src/app/actions.ts
 * 5. ../src/lib/db.ts
 * 6. ../src/lib/render-document.ts
 * 7. ../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/auth.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
/* นำเข้า ../src/lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { authenticated } from "../src/lib/auth";
afterEach(() => vi.unstubAllEnvs());
it("requires login in production unless the local desktop launcher explicitly opts in", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LOCAL_DEMO", "true");
  vi.stubEnv("SARABUN_LOCAL_DESKTOP", "");
  expect(await authenticated()).toBe(false);
  vi.stubEnv("SARABUN_LOCAL_DESKTOP", "false");
  expect(await authenticated()).toBe(false);
  vi.stubEnv("SARABUN_LOCAL_DESKTOP", "true");
  expect(await authenticated()).toBe(true);
});
