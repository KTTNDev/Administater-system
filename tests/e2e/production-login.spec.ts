/**
 * แผนที่อ่านโค้ด — tests/e2e/production-login.spec.ts
 * หน้าที่: กรณีทดสอบ production-login; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:os — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import os from "node:os";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawn, type ChildProcess } from "node:child_process";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomBytes } from "node:crypto";
test.describe("isolated production login", () => {
  test.skip(
    process.env.RUN_PRODUCTION_SMOKE !== "1",
    "Requires a completed production build; opt in explicitly",
  );
  let server: ChildProcess;
  const url = "http://127.0.0.1:3109",
    password = randomBytes(20).toString("hex");
  test.beforeAll(async () => {
    const workspace = process.cwd(),
      config = path.join(workspace, ".runtime-local.json"),
      runtime = fs.existsSync(config)
        ? JSON.parse(fs.readFileSync(config, "utf8")).path
        : workspace;
    const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "sarabun-login-smoke-"),
    );
    server = spawn(
      process.execPath,
      [
        path.join(runtime, "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3109",
      ],
      {
        cwd: runtime,
        windowsHide: true,
        stdio: "ignore",
        env: {
          ...process.env,
          NODE_ENV: "production",
          LOCAL_DEMO: "true",
          APP_URL: url,
          APP_PASSWORD: password,
          SESSION_SECRET: randomBytes(32).toString("hex"),
          DATABASE_PATH: path.join(folder, "data.sqlite"),
          SARABUN_SOURCE_DIR: workspace,
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
        },
      },
    );
    for (let n = 0; n < 40; n++) {
      if (server.exitCode !== null)
        throw new Error("Isolated server failed to start");
      try {
        const response = await fetch(url + "/api/health");
        if (response.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("Isolated server timeout");
  });
  test.afterAll(() => server?.kill());
  test("requires login even when LOCAL_DEMO is set, rejects wrong password, accepts valid session", async ({
    page,
  }) => {
    await page.goto(url);
    await expect(page).toHaveURL(url + "/login");
    await page.getByLabel("รหัสผ่านผู้ปฏิบัติงาน").fill("wrong-password");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.reload();
    await page.getByLabel("รหัสผ่านผู้ปฏิบัติงาน").fill(password);
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "ค้นหา จัดการ และสร้างหนังสือ" }),
    ).toBeVisible();
  });
});
