/**
 * แผนที่อ่านโค้ด — tests/production-setup.test.ts
 * หน้าที่: กรณีทดสอบ production-setup; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
/* นำเข้า node:util — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { parseEnv } from "node:util";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawnSync } from "node:child_process";
const script = path.resolve("scripts/configure-production.mjs");
const run = (folder: string, password: string) =>
  spawnSync(process.execPath, [script], {
    cwd: folder,
    input: JSON.stringify({ password }),
    encoding: "utf8",
  });
it("sets a password without exposing it or rotating the existing Drive encryption key", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-setup-")),
    file = path.join(folder, ".env.local");
  const secret = "existing-secret-".repeat(4);
  fs.writeFileSync(
    file,
    `SESSION_SECRET=${secret}\nGOOGLE_CLIENT_ID=keep-client\nAPP_PASSWORD=old\nDATABASE_PATH=./data/existing.sqlite\n`,
  );
  const password = "รหัสทดสอบ # $ back\\slash";
  const result = run(folder, password);
  expect(result.status, result.stderr).toBe(0);
  const env = parseEnv(fs.readFileSync(file, "utf8"));
  expect(env.APP_PASSWORD).toBe(password);
  expect(env.SESSION_SECRET).toBe(secret);
  expect(env.GOOGLE_CLIENT_ID).toBe("keep-client");
  expect(env.DATABASE_PATH).toBe("./data/existing.sqlite");
  expect(result.stdout + result.stderr).not.toContain(password);
  expect(result.stdout + result.stderr).not.toContain(secret);
});
it("rejects invalid passwords without changing configuration and initializes a missing session key", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-setup-")),
    file = path.join(folder, ".env.local"),
    original = "# local settings\n";
  fs.writeFileSync(file, original);
  for (const password of [
    "short",
    "has-newline-\nunsafe",
    `both-quotes-'"-invalid`,
  ]) {
    expect(run(folder, password).status).toBe(1);
    expect(fs.readFileSync(file, "utf8")).toBe(original);
  }
  expect(run(folder, "valid-long-password").status).toBe(0);
  expect(
    parseEnv(fs.readFileSync(file, "utf8")).SESSION_SECRET?.length,
  ).toBeGreaterThanOrEqual(32);
});
