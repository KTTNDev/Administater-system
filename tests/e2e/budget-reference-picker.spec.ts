/**
 * แผนที่อ่านโค้ด — tests/e2e/budget-reference-picker.spec.ts
 * หน้าที่: กรณีทดสอบ budget-reference-picker; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/lib/budget.ts
 * 2. ../../src/components/budget-transfers.tsx
 * 3. ../../src/app/budget-actions.ts
 * 4. ../../src/lib/budget-db.ts
 * 5. ../../src/lib/budget-document.ts
 * 6. ../../src/lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
test("selects Router with the exact citation page and renders the source beside the form", async ({
  page,
}) => {
  await page.goto("/?view=budget");
  await page
    .getByRole("button", { name: "ลองแพตเทิร์นจากไฟล์ตัวอย่าง" })
    .click();
  const row = page.locator("details").filter({
    has: page.getByText(
      "1. อุปกรณ์ค้นหาเส้นทางเครือข่าย (Router) — 21,300.00 บาท",
      { exact: true },
    ),
  });
  await row
    .getByText("ค้นอุปกรณ์ / เปิดบัญชีและหนังสือจำแนกประเภท", { exact: true })
    .click();
  await row.getByLabel("ค้นชื่ออุปกรณ์หรือคำในเอกสาร").fill("Router");
  await row
    .getByRole("button", { name: "ใช้อ้างอิงรายการนี้" })
    .first()
    .click();
  await expect(row.getByLabel("เลขรายการและชื่อรายการในบัญชี")).toHaveValue(
    "37 อุปกรณ์ค้นหาเส้นทางเครือข่าย (Router)",
  );
  await expect(row.getByLabel("หน้า PDF ที่อ้าง (นับจากปก)")).toHaveValue("20");
  await expect(row.getByLabel("ประเภท", { exact: true })).toHaveValue(
    "ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์",
  );
  const preview = page.getByLabel(
    "เกณฑ์ราคากลางและคุณลักษณะพื้นฐานการจัดหาอุปกรณ์และระบบคอมพิวเตอร์ ฉบับเดือนธันวาคม 2568",
    { exact: true },
  );
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator("canvas")).toHaveAttribute(
    "data-rendered",
    "true",
    { timeout: 30000 },
  );
  await page.screenshot({ path: "output/budget-reference-reader.png" });
  await row.getByLabel("ฐานการอ้างอิงราคา").selectOption("local");
  await row
    .getByLabel("เหตุผลที่ไม่ใช้รายการมาตรฐาน")
    .fill("คุณลักษณะเฉพาะที่ทดสอบแตกต่างจากรายการมาตรฐาน");
  await row
    .getByLabel("หลักฐานสืบราคา / เลขใบเสนอราคา / แหล่งราคาและวันที่")
    .fill("ใบเสนอราคาเพื่อทดสอบเท่านั้น");
  await row
    .getByRole("button", { name: "เลือกชุดหนังสืออ้างอิงตามตัวอย่าง" })
    .click();
  await row.getByText("ข้อความที่จะพิมพ์ใต้รายการ", { exact: true }).click();
  await expect(
    row.getByText(/เป็นไปตามหนังสือกระทรวงมหาดไทย ที่ มท 0808.2\/ว 1989/),
  ).toBeVisible();
});
