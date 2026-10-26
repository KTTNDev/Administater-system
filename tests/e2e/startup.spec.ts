/**
 * แผนที่อ่านโค้ด — tests/e2e/startup.spec.ts
 * หน้าที่: กรณีทดสอบ startup; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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

test("startup opens the dashboard, document preview, and settings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator(".app-shell")).toBeVisible();
  await page
    .getByRole("button", { name: "สร้างหนังสือใหม่", exact: true })
    .click();
  await page
    .locator(".template-card")
    .filter({
      has: page.getByRole("heading", { name: "หนังสือภายนอก", exact: true }),
    })
    .click();

  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".page").first()).toBeVisible();
  await expect(page.locator(".preview-footer")).toContainText(
    "ตัวอย่าง 1 หน้า",
  );

  await page
    .getByRole("button", { name: "ตั้งค่าหน่วยงานและ Drive", exact: true })
    .click();
  await expect(page.locator(".settings-main")).toBeVisible();
  expect(errors).toEqual([]);
});
