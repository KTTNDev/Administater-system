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
      "rgb(35, 43, 49)",
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

test("editor resizing and section shortcuts do not alter preview content", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "แบบหนังสือราชการ", exact: true })
    .click();
  await page
    .locator(".template-card")
    .filter({
      has: page.getByRole("heading", { name: "หนังสือภายนอก", exact: true }),
    })
    .click();
  const iframe = page.getByTitle("ตัวอย่างหนังสือ A4", { exact: true });
  await expect(
    page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator(".page"),
  ).toBeVisible();
  const source = await iframe.getAttribute("srcdoc");
  const divider = page.getByRole("separator", {
    name: "ปรับความกว้างพื้นที่กรอก",
  });
  await divider.focus();
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "48");
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(
    48,
  );
  expect(
    await page.evaluate(() =>
      Number(localStorage.getItem("sarabun-editor-share")),
    ),
  ).toBeGreaterThan(48);
  await page
    .getByRole("button", { name: "คืนสัดส่วนพื้นที่เดิม", exact: true })
    .click();
  await expect(divider).toHaveAttribute("aria-valuenow", "46");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "ไปที่ตรวจทาน", exact: true }).click();
  expect(
    await page.locator(".form-pane").evaluate((node) => node.scrollTop),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "ไปที่ส่วนหัว", exact: true }).click();
  expect(await iframe.getAttribute("srcdoc")).toBe(source);
  await page.getByRole("button", { name: "มืดนุ่ม", exact: true }).click();
  fs.mkdirSync("output/appearance-check", { recursive: true });
  await page.screenshot({ path: "output/appearance-check/editor-dim.png" });
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(divider).not.toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      page.getByRole("button", { name: "มืดนุ่ม", exact: true }),
    ).toBeVisible();
  }
});
