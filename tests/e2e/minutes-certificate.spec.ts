/**
 * แผนที่อ่านโค้ด — tests/e2e/minutes-certificate.spec.ts
 * หน้าที่: กรณีทดสอบ minutes-certificate; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/lib/document.ts
 * 2. ../../src/lib/minutes-presets.ts
 * 3. ../../src/components/minutes-details.tsx
 * 4. ../../src/components/minutes-editor.tsx
 * 5. ../../src/components/minutes-speeches-editor.tsx
 * 6. ../../src/components/workspace.tsx
 * 7. ../../src/app/actions.ts
 * 8. ../../src/lib/render-document.ts
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
test("agenda form reorders items and preserves both modes", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page
    .getByRole("button", { name: "แบบหนังสือราชการ", exact: true })
    .click();
  await page
    .locator(".template-card")
    .filter({
      has: page.getByRole("heading", { name: "รายงานการประชุม", exact: true }),
    })
    .click();
  await page.getByLabel("รูปแบบเนื้อหารายงาน").selectOption("agenda");
  await page
    .getByRole("button", { name: "เพิ่มวาระการประชุม", exact: true })
    .click();
  await page.getByLabel("หัวข้อวาระ", { exact: true }).fill("เรื่องเสนอ");
  await page.getByLabel("ข้ออภิปราย / รายละเอียด").fill("รายละเอียดตัวอย่าง");
  await page
    .getByRole("button", { name: "เพิ่มวาระการประชุม", exact: true })
    .click();
  await page
    .getByLabel("หัวข้อวาระ", { exact: true })
    .nth(1)
    .fill("เรื่องแจ้ง");
  await page
    .getByLabel("ข้ออภิปราย / รายละเอียด")
    .nth(1)
    .fill("รายละเอียดถัดไป");
  await page
    .getByRole("button", { name: "เลื่อนวาระ 2 ขึ้น", exact: true })
    .click();
  await expect(
    page.getByLabel("หัวข้อวาระ", { exact: true }).first(),
  ).toHaveValue("เรื่องแจ้ง");
  await page.getByLabel("รูปแบบเนื้อหารายงาน").selectOption("free");
  await page.getByLabel("รูปแบบเนื้อหารายงาน").selectOption("agenda");
  await expect(
    page.getByLabel("หัวข้อวาระ", { exact: true }).first(),
  ).toHaveValue("เรื่องแจ้ง");
  await expect(
    page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator("#pages"),
  ).toContainText("ระเบียบวาระที่ 1  เรื่องแจ้ง");
  await page.screenshot({
    path: "output/minutes-editor-ui.png",
    fullPage: false,
  });
});
test("long agendas retain all text and resolutions across A4 pages", async ({
  page,
}) => {
  const meetingAgenda = Array.from({ length: 6 }, (_, i) => ({
    title: `หัวข้อ ${i + 1}`,
    discussion:
      "ข้อความอภิปรายการประชุมและรายละเอียดที่ต้องบันทึก ".repeat(45) +
      `จบวาระ ${i + 1}`,
    resolution: `เห็นชอบข้อเสนอ ${i + 1}`,
    resolutionLabel: "มติที่ประชุม" as const,
  }));
  await page.setContent(
    documentHtml(
      {
        ...newDraft("minutes"),
        firstPageTop: "25",
        numeralStyle: "thai",
        subject: "ตัวอย่างรายงานการประชุม",
        meetingNo: "1/2569",
        location: "ห้องประชุมเทศบาล",
        attendees: "ผู้เข้าประชุมตัวอย่าง",
        startTime: "09:00",
        endTime: "12:00",
        recorder: "ผู้จดตัวอย่าง",
        minutesMode: "agenda",
        meetingAgenda,
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
  ).toBe(false);
  expect(await page.locator(".page").count()).toBeGreaterThan(1);
  await expect(
    page.locator(".page").first().locator(".page-number"),
  ).toHaveCount(0);
  const text = await page.locator("#pages").innerText();
  for (const digit of "๑๒๓๔๕๖") {
    expect(text).toContain(`จบวาระ ${digit}`);
    expect(text).toContain(`เห็นชอบข้อเสนอ ${digit}`);
  }
  await page
    .locator(".page")
    .first()
    .screenshot({ path: "output/minutes-agenda-preview.png" });
});
test("optional certificate photo measures 40 by 60 mm and stays in page bounds", async ({
  page,
}) => {
  await page.setContent(
    documentHtml(
      {
        ...newDraft("certificate"),
        firstPageTop: "25",
        organization: "เทศบาลตัวอย่าง",
        number: "001/2569",
        body: "หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า บุคคลตัวอย่างเป็นเจ้าหน้าที่ของเทศบาล",
        signer: "ผู้ลงนามตัวอย่าง",
        position: "นายกเทศมนตรี",
        certificatePhotoArea: true,
        certificateRecipient: "บุคคลตัวอย่าง",
      },
      assets,
    ),
  );
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __paginationDone: boolean }).__paginationDone,
  );
  const size = await page.locator(".certificate-photo").boundingBox();
  expect(size!.width).toBeCloseTo((40 * 96) / 25.4, 0);
  expect(size!.height).toBeCloseTo((60 * 96) / 25.4, 0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __overflow: boolean }).__overflow,
    ),
  ).toBe(false);
  await page
    .locator(".page")
    .first()
    .screenshot({ path: "output/certificate-photo-preview.png" });
});
