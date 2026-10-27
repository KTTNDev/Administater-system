import { test, expect } from "@playwright/test";
import { templates } from "../../src/lib/templates";
import { createHash } from "node:crypto";
import fs from "node:fs";

// ธีมเป็นเพียง UI: ทดสอบกระดาษจริงใน iframe เพื่อจับการกลับสี/เปลี่ยน layout โดยไม่ตั้งใจ
for (const template of templates) {
  test(`theme preserves ${template.id} document pixels and HTML`, async ({
    page,
  }, testInfo) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "แบบหนังสือราชการ", exact: true })
      .click();
    await page
      .locator(".template-card")
      .filter({
        has: page.getByRole("heading", { name: template.name, exact: true }),
      })
      .click();
    const iframe = page.getByTitle("ตัวอย่างหนังสือ A4", { exact: true });
    const paper = page
      .frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]')
      .locator(".page")
      .first();
    await page
      .getByRole("combobox", { name: "ขนาดตัวอย่าง", exact: true })
      .selectOption("50");
    await expect(paper).toBeVisible({ timeout: 30000 });
    await expect
      .poll(
        () =>
          paper.evaluate(() =>
            Boolean(
              (window as unknown as { __paginationDone: boolean })
                .__paginationDone,
            ),
          ),
        { timeout: 30000 },
      )
      .toBe(true)
      .catch(async (error) => {
        console.log("Preview readiness diagnostics", await paper.evaluate(() => ({
          fonts: document.fonts.status,
          source: !!document.getElementById("source"),
          pages: document.querySelectorAll(".page").length,
          images: Array.from(document.images).map((i) => ({ complete: i.complete, width: i.naturalWidth, className: i.className })),
        })));
        throw error;
      });
    await paper.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "สว่างนุ่ม", exact: true }).click();
    const source = await iframe.getAttribute("srcdoc");
    // ถ่ายที่ขอบ iframe จริง: locator ภายใน iframe ที่ scale อาจคืน crop แบบไม่ scale
    // และติดพื้นหลัง UI นอกกระดาษ ซึ่งเปลี่ยนสีตามธีมโดยตั้งใจ
    const capturePaper = async () => {
      const box = (await iframe.boundingBox())!;
      // ขอบ iframe ที่ zoom 50% อยู่บน fractional pixel จึง blend กับพื้นรอบกระดาษ
      // ตัดขอบนอก 2px ออกก่อนเทียบเนื้อกระดาษ; ไม่แตะข้อมูลหรือ CSS เอกสาร
      return page.screenshot({
        animations: "disabled",
        clip: {
          x: Math.ceil(box.x) + 2,
          y: Math.ceil(box.y) + 2,
          width: Math.floor(box.width) - 4,
          height: Math.floor(box.height) - 4,
        },
      });
    };
    const before = await capturePaper();
    await page.getByRole("button", { name: "มืดนุ่ม", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "dim");
    expect(await iframe.getAttribute("srcdoc"), template.name).toBe(source);
    const after = await capturePaper();
    fs.mkdirSync("output/appearance-check", { recursive: true });
    fs.writeFileSync(
      "output/appearance-check/" + template.id + "-light.png",
      before,
    );
    fs.writeFileSync(
      "output/appearance-check/" + template.id + "-dim.png",
      after,
    );
    await testInfo.attach(template.id + "-light", {
      body: before,
      contentType: "image/png",
    });
    await testInfo.attach(template.id + "-dim", {
      body: after,
      contentType: "image/png",
    });
    expect(
      createHash("sha256").update(after).digest("hex"),
      template.name,
    ).toBe(createHash("sha256").update(before).digest("hex"));
    await expect(iframe).toHaveCSS("color-scheme", /only light|light only/);
    await expect(page.locator(".form-pane")).toHaveCSS(
      "background-color",
      "rgb(32, 40, 46)",
    );
  });
}

test("theme preference survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "มืดนุ่ม", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "มืดนุ่ม", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "สว่างนุ่ม", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "สว่างนุ่ม", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
