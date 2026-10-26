/**
 * แผนที่อ่านโค้ด — tests/e2e/setup-readiness.spec.ts
 * หน้าที่: กรณีทดสอบ setup-readiness; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/app/page.tsx
 * 2. ../../src/components/workspace.tsx
 * 3. ../../src/lib/document.ts
 * 4. ../../src/app/actions.ts
 * 5. ../../src/lib/db.ts
 * 6. ../../src/lib/render-document.ts
 * 7. ../../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
test("shows safe setup status and actionable instructions", async ({
  page,
}) => {
  await page.goto("/?view=settings");
  const panel = page.getByRole("region", { name: "ความพร้อมใช้งานจริง" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("รหัสผ่านผู้ปฏิบัติงาน:");
  await panel
    .getByText("ตั้งรหัสผ่านและเปิดใช้งานจริง", { exact: true })
    .click();
  await expect(panel).toContainText("Setup-Sarabun-Production.cmd");
  await panel
    .getByText("สิ่งที่ต้องเตรียมสำหรับ Google Drive", { exact: true })
    .click();
  await expect(panel).toContainText("/api/google/callback");
  await panel.getByRole("button", { name: "ตรวจสถานะอีกครั้ง" }).click();
  await expect(
    panel.getByRole("button", { name: "ตรวจสถานะอีกครั้ง" }),
  ).toBeEnabled();
});
