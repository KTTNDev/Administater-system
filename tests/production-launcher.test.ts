/**
 * แผนที่อ่านโค้ด — tests/production-launcher.test.ts
 * หน้าที่: กรณีทดสอบ production-launcher; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/app/page.tsx
 * 2. ../src/components/workspace.tsx
 * 3. ../src/lib/document.ts
 * 4. ../src/app/actions.ts
 * 5. ../src/lib/db.ts
 * 6. ../src/lib/render-document.ts
 * 7. ../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../next.config.mjs
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { it, expect } from "vitest";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:os — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import os from "node:os";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawnSync } from "node:child_process";
/* นำเข้า ../next.config.mjs — กำหนดโฟลเดอร์ build ขนาด Server Action แพ็กเกจฝั่ง server และ HTTP headers */
import config from "../next.config.mjs";
it("blocks missing production credentials and build, then accepts a configured installation without printing secrets", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-production-"));
  const run = () =>
    spawnSync(
      process.execPath,
      [path.resolve("scripts/check-production.mjs")],
      {
        cwd: folder,
        encoding: "utf8",
        env: {
          ...process.env,
          APP_PASSWORD: "",
          SESSION_SECRET: "",
          APP_URL: "",
        },
      },
    );
  fs.writeFileSync(
    path.join(folder, ".env.local"),
    "APP_URL=http://127.0.0.1:3000\n",
  );
  expect(run().status).toBe(1);
  const secret = "test-secret-".repeat(4),
    password = "test-password-long";
  fs.writeFileSync(
    path.join(folder, ".env.local"),
    `APP_URL=http://127.0.0.1:3000\nAPP_PASSWORD=${password}\nSESSION_SECRET=${secret}\n`,
  );
  // Node loadEnvFile preserves existing variables, so use a clean environment for configured checks.
  const env = { ...process.env };
  delete env.APP_PASSWORD;
  delete env.SESSION_SECRET;
  delete env.APP_URL;
  const configured = () =>
    spawnSync(
      process.execPath,
      [path.resolve("scripts/check-production.mjs")],
      { cwd: folder, encoding: "utf8", env },
    );
  expect(configured().status).toBe(1);
  const build = path.join(folder, config.distDir || ".next");
  fs.mkdirSync(build);
  fs.writeFileSync(path.join(build, "BUILD_ID"), "test");
  const result = configured();
  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).not.toContain(secret);
  expect(result.stdout + result.stderr).not.toContain(password);
});
