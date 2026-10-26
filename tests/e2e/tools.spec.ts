/**
 * แผนที่อ่านโค้ด — tests/e2e/tools.spec.ts
 * หน้าที่: กรณีทดสอบ tools; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
test("drafting tools, legal library, side reader, and conclusions survive save", async ({
  page,
}) => {
  test.setTimeout(180000);
  const name = `ทดสอบเครื่องมือ ${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "หนังสือภายใน แบบบันทึกข้อความ" })
    .click();
  await page.getByRole("button", { name: "ใช้ข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("เรื่อง / ชื่อร่าง").fill(name);
  await page.getByRole("button", { name: "ด่วนที่สุด", exact: true }).click();
  await page.getByRole("button", { name: "ลับ", exact: true }).click();
  await page
    .getByLabel("ตราสำเนา", { exact: true })
    .selectOption("สำเนาคู่ฉบับ");
  await page.getByLabel("ตัวเลขในเอกสาร", { exact: true }).selectOption("thai");
  await page.getByLabel("แยกเนื้อหาตามหน้าที่ของย่อหน้า").check();
  await page
    .getByLabel("เลือกประโยคตามวัตถุประสงค์")
    .selectOption("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ");
  await page
    .getByRole("button", { name: "เพิ่มเป็นย่อหน้าสุดท้าย", exact: true })
    .click();
  await expect(
    page.getByLabel("จึงเรียนมาเพื่อ…", { exact: true }),
  ).toHaveValue("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ");
  await page
    .getByRole("button", { name: "+ เพิ่มผู้เสนอ", exact: true })
    .click();
  await page.getByLabel("ชื่อผู้เสนอ", { exact: true }).fill("ผู้เสนอทดสอบ");
  await page
    .getByLabel("ตำแหน่งผู้เสนอ", { exact: true })
    .fill("เจ้าหน้าที่ทดสอบ");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: /เพิ่มส่วนความเห็น/ }).click();
  await expect(
    page.getByRole("button", { name: /เพิ่มส่วนความเห็น/ }),
  ).toBeDisabled();
  await page.getByText("คลังกฎหมายและเอกสารอ้างอิง", { exact: true }).click();
  await page
    .getByLabel("ชื่อกฎหมายและฉบับแก้ไข", { exact: true })
    .fill(name + " กฎหมาย");
  await page.getByLabel("มาตรา / ข้อ", { exact: true }).fill("ข้อ 12");
  await page
    .getByLabel("แนบ PDF (ไม่เกิน 700 KB)", { exact: true })
    .setInputFiles("D:/sarabun/references/internal.pdf");
  await page
    .getByRole("button", { name: "บันทึกเข้าคลัง", exact: true })
    .click();
  await expect(
    page.getByText("บันทึกคลังกฎหมายแล้ว", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("ค้นชื่อกฎหมาย / มาตราในคลัง", { exact: true })
    .fill(name);
  const picker = page.getByLabel("เลือกกฎหมายที่เกี่ยวข้อง", { exact: true });
  await expect(picker.locator("option")).toHaveCount(2);
  await picker.selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "แทรกชื่อและมาตรา", exact: true })
    .click();
  await expect(
    page.getByLabel("ข้อระเบียบ/กฎหมาย", { exact: true }),
  ).toHaveValue(name + " กฎหมาย ข้อ 12");
  await page
    .getByRole("button", { name: "เปิดอ่านข้างร่าง", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("complementary", { name: "อ่านกฎหมายควบคู่ร่าง" }),
  ).toBeVisible();
  const src = await page.locator(".law-reader iframe").getAttribute("src");
  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("inline");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page
    .getByRole("button", { name: "กลับตัวอย่าง A4", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(frame.locator(".page")).not.toHaveCount(1);
  await expect(frame.locator(".opinion")).toHaveCount(4);
  await expect(frame.locator(".urgency")).toHaveText("ด่วนที่สุด");
  await expect(frame.locator(".memo-row")).toContainText("๒๕๖๙");
  const pages = await frame.locator(".page").count();
  await expect(frame.locator(".security")).toHaveCount(pages * 2);
  await expect(frame.locator(".security-control")).toHaveCount(pages);
  await expect(frame.locator(".memo-field").first()).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await page.getByRole("button", { name: "บันทึกร่าง", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "บันทึกร่างเรียบร้อยแล้ว",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ดาวน์โหลด PDF", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain(name);
  await page.reload();
  await page.getByLabel("ค้นหาร่างหนังสือ").fill(name);
  await page
    .getByRole("button", { name: new RegExp("^" + name + " ") })
    .first()
    .click();
  await expect(
    page.getByLabel("จึงเรียนมาเพื่อ…", { exact: true }),
  ).toHaveValue("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ");
  await expect(
    page.getByLabel("ข้อระเบียบ/กฎหมาย", { exact: true }),
  ).toHaveValue(name + " กฎหมาย ข้อ 12");
  await expect(page.getByLabel("ชื่อผู้เสนอ", { exact: true })).toHaveValue(
    "ผู้เสนอทดสอบ",
  );
  await page.screenshot({
    path: "D:/sarabun/references/extended-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "กลับรายการ" }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `ลบ ${name}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("ลบร่างเรียบร้อยแล้ว");
  await page
    .getByRole("button", { name: "หนังสือภายใน แบบบันทึกข้อความ" })
    .click();
  await page.getByText("คลังกฎหมายและเอกสารอ้างอิง", { exact: true }).click();
  await page
    .locator(".repeat-card")
    .filter({ has: page.getByText(name + " กฎหมาย", { exact: true }) })
    .getByRole("button", { name: "ลบ", exact: true })
    .click();
  await expect(page.getByText(name + " กฎหมาย", { exact: true })).toHaveCount(
    0,
  );
});
