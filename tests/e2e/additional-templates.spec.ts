/**
 * แผนที่อ่านโค้ด — tests/e2e/additional-templates.spec.ts
 * หน้าที่: กรณีทดสอบ additional-templates; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
 * อ่านต่อจาก import: ../../src/lib/document.ts, ../../src/lib/render-document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า ../../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../../src/lib/document";
/* นำเข้า ../../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../../src/lib/render-document";
const data = (file: string, mime: string) =>
  `data:${mime};base64,${fs.readFileSync("public/" + file).toString("base64")}`;
const assets = {
  regular: data("fonts/THSarabunNew.ttf", "font/ttf"),
  bold: data("fonts/THSarabunNew-Bold.ttf", "font/ttf"),
  garuda: data("assets/garuda.png", "image/png"),
  routingStamp: data("assets/approval-routing-stamp.png", "image/png"),
  copyMark: data("assets/copy-counterpart.png", "image/png"),
};
test("new variants render without overflow and keep the requested top margin", async ({
  page,
}) => {
  for (const type of [
    "external",
    "internal",
    "memorandum",
    "stamped",
    "order",
    "regulation",
    "announcement",
    "certificate",
    "minutes",
  ] as const) {
    await page.setContent(
      documentHtml(
        {
          ...newDraft(type),
          firstPageTop: "25",
          memoEmblem: true,
          subject: "ทดสอบรูปแบบเพิ่มเติม",
          organization: "เทศบาลตัวอย่าง",
          number: "2",
          body: "ข้อความตัวอย่างสำหรับตรวจรูปแบบ",
          signer: "ผู้ลงนามตัวอย่าง",
          position: "นายกเทศมนตรี",
          orderReceivedBy: "นายกเทศมนตรี",
        },
        assets,
      ),
    );
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __paginationDone: boolean }).__paginationDone,
    );
    expect(
      await page.evaluate(
        () => (window as unknown as { __overflow: boolean }).__overflow,
      ),
      type,
    ).toBe(false);
    expect(
      await page
        .locator(".page")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
    ).toBeCloseTo((25 * 96) / 25.4, 1);
    if (type === "order") {
      await expect(page.locator(".received-order")).toHaveText(
        "รับคำสั่งนายกเทศมนตรี",
      );
      await page.screenshot({ path: "output/additional-order.png" });
    }
    if (type === "regulation") {
      await expect(
        page.locator(".title").filter({ hasText: "ว่าด้วย" }),
      ).toBeVisible();
      await page.screenshot({ path: "output/additional-regulation.png" });
    }
  }
});
test("reference manual can be read at a selected template page", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "แบบหนังสือราชการ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "เปิดคู่มือแบบหนังสือเพิ่มเติม 40 หน้า" })
    .click();
  await page.getByLabel("เลือกแบบในคู่มือ").selectOption("18");
  await expect(
    page.locator('canvas[aria-label="เอกสารหน้า 18"]'),
  ).toHaveAttribute("data-rendered", "true", { timeout: 30000 });
});
