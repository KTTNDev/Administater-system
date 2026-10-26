/**
 * แผนที่อ่านโค้ด — scripts/run-next.mjs
 * หน้าที่: ตัวเรียก Next.js จากโฟลเดอร์นี้ ส่ง environment ให้กระบวนการลูกและส่งต่อสัญญาณปิด
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./open-local.mjs
 * 2. ./run-next.mjs ← คุณอยู่ที่นี่
 * 3. ../next.config.mjs
 * 4. ../src/app/api/health/route.ts
 * 5. ../src/app/page.tsx
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
// Compatibility entry point for the desktop launcher. Always run this checkout.
// Old .runtime-local.json files and AppData mirrors are intentionally ignored.
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:url — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { fileURLToPath } from "node:url";
/* นำเข้า node:module — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { createRequire } from "node:module";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawn } from "node:child_process";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(mode)) {
  console.error("Usage: node scripts/run-next.mjs [dev|build|start]");
  process.exit(1);
}

const require = createRequire(path.join(workspace, "package.json"));
let next;
try {
  next = require.resolve("next/dist/bin/next");
} catch {
  console.error(
    "Next.js is missing from this project. Run npm ci in " + workspace,
  );
  process.exit(1);
}
const args = [next, mode];
if (mode !== "build")
  args.push(
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.SARABUN_PORT || "3000",
  );
args.push(...process.argv.slice(3));

const child = spawn(process.execPath, args, {
  cwd: workspace,
  stdio: "inherit",
  env: { ...process.env, SARABUN_SOURCE_DIR: workspace },
});
child.on("error", (error) => {
  console.error("Could not start Next.js:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode =
    code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
