/**
 * แผนที่อ่านโค้ด — tests/e2e/action-search.spec.ts
 * หน้าที่: กรณีทดสอบ action-search; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
test("searches work intent, opens a destination and supports keyboard and empty state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /อยากทำอะไร/ }).click();
  const dialog = page.getByRole("dialog"),
    input = page.getByRole("textbox", {
      name: "ค้นหาเมนูด้วยสิ่งที่ต้องการทำ",
    });
  await input.fill("โอนงบซื้อคอม");
  await dialog.getByRole("button", { name: /โอนงบประมาณ/ }).click();
  await expect(
    page.getByRole("heading", { name: "โอนงบประมาณ", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await input.fill("ซื้อพิซซ่า");
  await expect(dialog).toContainText("ยังไม่พบงานที่ตรง");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.keyboard.press("Control+k");
  await input.fill("บันทึกข้อความ");
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "จัดทำร่างหนังสือใหม่" }),
  ).toBeVisible();
  await page.getByLabel("เรื่อง / ชื่อร่าง").fill("ร่างที่ยังไม่บันทึก");
  await page.keyboard.press("Control+k");
  await input.fill("กฎหมาย");
  page.once("dialog", (d) => d.dismiss());
  await input.press("Enter");
  await expect(page.getByLabel("เรื่อง / ชื่อร่าง")).toHaveValue(
    "ร่างที่ยังไม่บันทึก",
  );
});
test("search dialog fits a mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /อยากทำอะไร/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
