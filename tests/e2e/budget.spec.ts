/**
 * แผนที่อ่านโค้ด — tests/e2e/budget.spec.ts
 * หน้าที่: กรณีทดสอบ budget; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/lib/budget.ts
 * 2. ../../src/components/budget-transfers.tsx
 * 3. ../../src/app/budget-actions.ts
 * 4. ../../src/lib/budget-db.ts
 * 5. ../../src/lib/budget-document.ts
 * 6. ../../src/lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../src/lib/render-document.ts, ../../src/lib/budget.ts, ../../src/lib/budget-document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า ../../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../../src/lib/render-document";
/* นำเข้า ../../src/lib/budget.ts — กฎคำขอโอนงบ รายการโอนลด/เพิ่ม การคำนวณยอด และการตรวจความครบถ้วน */
import { budgetSample } from "../../src/lib/budget";
/* นำเข้า ../../src/lib/budget-document.ts — แปลงข้อมูลคำขอโอนงบเป็น Draft ของหนังสือภายในเพื่อใช้ตัวจัดหน้าเดิม */
import { budgetDraft } from "../../src/lib/budget-document";
const data = (file: string, mime: string) =>
  `data:${mime};base64,${fs.readFileSync("public/" + file).toString("base64")}`;
const assets = {
  regular: data("fonts/THSarabunNew.ttf", "font/ttf"),
  bold: data("fonts/THSarabunNew-Bold.ttf", "font/ttf"),
  garuda: data("assets/garuda.png", "image/png"),
  routingStamp: data("assets/approval-routing-stamp.png", "image/png"),
  copyMark: data("assets/copy-counterpart.png", "image/png"),
};
test("budget pattern paginates all entries, totals and five opinions", async ({
  page,
}) => {
  const b = budgetSample("2026-09-15");
  b.signer = "ผู้เสนอ (ตัวอย่าง)";
  b.position = "เจ้าพนักงานธุรการ";
  b.increases.forEach((r, i) =>
    Object.assign(
      r,
      i === 0
        ? {
            pricingBasis: "standard",
            sourceId: "ict",
            sourcePage: 20,
            sourceItem: "37 อุปกรณ์ค้นหาเส้นทางเครือข่าย (Router)",
            citedCirculars: ["1095"],
          }
        : {
            pricingBasis: "local",
            pricingReason:
              "[ตัวอย่าง: ระบุผลการเทียบคุณลักษณะที่จำเป็นกับบัญชีมาตรฐาน]",
            pricingEvidence:
              "[ตัวอย่าง: กรอกใบเสนอราคาและวันที่ของหลักฐานจริง]",
            citedCirculars: ["1095", "1989", "7509"],
          },
    ),
  );
  await page.setContent(documentHtml(budgetDraft(b), assets));
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __paginationDone: boolean }).__paginationDone,
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __overflow: boolean }).__overflow,
    ),
  ).toBe(false);
  await expect(
    page.locator(".page").first().locator(".page-number"),
  ).toHaveCount(0);
  expect(await page.locator(".budget-line").count()).toBe(49);
  await expect(page.locator("body")).toContainText("๑๒๘,๕๔๐.๐๐");
  await expect(page.locator("body")).toContainText("ความเห็นนายกเทศมนตรี");
  await expect(page.locator("body")).toContainText("ว ๑๙๘๙");
  fs.mkdirSync("output/pdf", { recursive: true });
  await page.pdf({
    path: "output/pdf/budget-transfer-pattern.pdf",
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page
    .locator(".page")
    .first()
    .screenshot({ path: "output/budget-pattern-first.png" });
  await page
    .locator(".page")
    .last()
    .screenshot({ path: "output/budget-pattern-last.png" });
});
test("budget screen loads pattern and prevents incomplete generation", async ({
  page,
}) => {
  await page.goto("/?view=budget");
  await page
    .getByRole("button", { name: "ลองแพตเทิร์นจากไฟล์ตัวอย่าง" })
    .click();
  await expect(
    page.getByRole("button", { name: "สร้าง / เปิดบันทึกข้อความ" }),
  ).toBeDisabled();
  await page
    .getByLabel("ผู้เสนอ / ผู้ลงนาม", { exact: true })
    .fill("ผู้เสนอ (ทดสอบ)");
  await page
    .getByLabel("ตำแหน่ง", { exact: true })
    .first()
    .fill("เจ้าพนักงานธุรการ");
  await page
    .getByLabel("ตรวจผู้มีอำนาจและข้อระเบียบที่ใช้กับรายการนี้แล้ว")
    .check();
  await expect(
    page.getByRole("button", { name: "สร้าง / เปิดบันทึกข้อความ" }),
  ).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/budget-workspace.png" });
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: /แดชบอร์ดเอกสาร/ }).click();
  await expect(
    page.getByRole("heading", { name: "โอนงบประมาณ", exact: true }),
  ).toBeVisible();
});
