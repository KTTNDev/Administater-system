import { test, expect } from "@playwright/test";

test("startup opens the dashboard, document preview, and settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("button", { name: "สร้างหนังสือใหม่", exact: true }).click();
  await page.locator(".template-card").filter({
    has: page.getByRole("heading", { name: "หนังสือภายนอก", exact: true }),
  }).click();

  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".page").first()).toBeVisible();
  await expect(page.locator(".preview-footer")).toContainText("ตัวอย่าง 1 หน้า");

  await page.getByRole("button", { name: "ตั้งค่าหน่วยงานและ Drive", exact: true }).click();
  await expect(page.locator(".settings-main")).toBeVisible();
  expect(errors).toEqual([]);
});
