/**
 * แผนที่อ่านโค้ด — tests/e2e/backup-manager.spec.ts
 * หน้าที่: กรณีทดสอบ backup-manager; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/components/backup-manager.tsx
 * 2. ../../src/app/backup-actions.ts
 * 3. ../../src/lib/backup-catalog.ts
 * 4. ../../scripts/restore-backup.mjs
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
test("backup manager is reachable from settings", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "ตั้งค่าหน่วยงานและ Drive", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "กู้คืนชุดสำรอง" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "โหลดรายการชุดสำรอง" }).click();
  await expect(
    panel.getByText(/ยังไม่มีชุดสำรอง/).or(panel.getByRole("table")),
  ).toBeVisible();
});
