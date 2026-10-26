/**
 * แผนที่อ่านโค้ด — tests/e2e/attachments-ui.spec.ts
 * หน้าที่: กรณีทดสอบ attachments-ui; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/lib/document.ts
 * 2. ../../src/components/attachment-editor.tsx
 * 3. ../../src/app/attachment-actions.ts
 * 4. ../../src/lib/attachments.ts
 * 5. ../../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
test("upload, preview, save and export a cover with its attachments", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "สร้างหนังสือใหม่", exact: true })
    .click();
  await page
    .getByRole("button", { name: /หนังสือภายใน/ })
    .first()
    .click();
  const subject = `ข้อมูลสาธิต — บันทึกพร้อมเอกสารแนบ ${Date.now()}`;
  await page.getByLabel("เรื่อง / ชื่อร่าง").fill(subject);
  const pdf = await PDFDocument.create();
  pdf
    .addPage([400, 500])
    .drawText("DEMO - Agenda page 1", { x: 30, y: 450, size: 16 });
  pdf
    .addPage([500, 400])
    .drawText("DEMO - Agenda page 2", { x: 30, y: 350, size: 16 });
  await page.getByLabel("เพิ่ม PDF หรือรูปภาพ").setInputFiles({
    name: "กำหนดการสาธิต.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(page.locator(".attachment-card")).toContainText("2 หน้า");
  await expect(
    page
      .frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]')
      .locator(".body-text"),
  ).toContainText("ตามเอกสารที่แนบมาพร้อมนี้");
  await page.locator(".attachment-preview").scrollIntoViewIfNeeded();
  await expect(
    page.locator('.attachment-preview canvas[data-rendered="true"]').first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "บันทึกร่าง", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "บันทึกร่างเรียบร้อยแล้ว",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ดาวน์โหลด PDF", exact: true })
    .click();
  const file = await download;
  const savedPath = await file.path();
  const merged = await PDFDocument.load(fs.readFileSync(savedPath!));
  expect(merged.getPageCount()).toBe(3);
  expect(
    merged
      .getPages()
      .slice(-2)
      .map((p) => p.getWidth()),
  ).toEqual([400, 500]);
  await file.saveAs("output/attachment-demo.pdf");
  await page.screenshot({
    path: "output/attachment-workspace.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "เอาออกจากร่าง" }).click();
  await expect(page.locator(".attachment-preview")).toHaveCount(0);
  await expect(
    page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator(".content"),
  ).not.toContainText("ตามเอกสารที่แนบมาพร้อมนี้");
  // Return to the saved demo; removing a file from the draft does not delete stored attachments.
  page.on("dialog", (d) => d.accept());
  await page.reload();
});
