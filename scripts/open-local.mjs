/**
 * แผนที่อ่านโค้ด — scripts/open-local.mjs
 * หน้าที่: เปิด checkout นี้ หาเซิร์ฟเวอร์เดิมหรือพอร์ตว่าง แล้วเปิดเว็บของโฟลเดอร์ที่ถูกต้อง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./open-local.mjs ← คุณอยู่ที่นี่
 * 2. ./run-next.mjs
 * 3. ../next.config.mjs
 * 4. ../src/app/api/health/route.ts
 * 5. ../src/app/page.tsx
 * อ่านต่อจาก import: ../next.config.mjs
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
// Opens this checkout. Never redirects to another machine's runtime or source folder.
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:net — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import net from "node:net";
/* นำเข้า node:url — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { fileURLToPath } from "node:url";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { createHash } from "node:crypto";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawn, spawnSync } from "node:child_process";
/* นำเข้า ../next.config.mjs — กำหนดโฟลเดอร์ build ขนาด Server Action แพ็กเกจฝั่ง server และ HTTP headers */
import config from "../next.config.mjs";
const workspace = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
process.chdir(workspace);
let origin = "http://127.0.0.1:3000";
const workspaceId = createHash("sha256")
  .update(workspace.toLowerCase())
  .digest("hex")
  .slice(0, 16);
/* identity: เปิด checkout นี้ หาเซิร์ฟเวอร์เดิมหรือพอร์ตว่าง แล้วเปิดเว็บของโฟลเดอร์ที่ถูกต้อง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
async function identity(url = origin) {
  try {
    return await (
      await fetch(url + "/api/health", { signal: AbortSignal.timeout(1500) })
    ).json();
  } catch {
    return null;
  }
}
/* openBrowser: เปิด checkout นี้ หาเซิร์ฟเวอร์เดิมหรือพอร์ตว่าง แล้วเปิดเว็บของโฟลเดอร์ที่ถูกต้อง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function openBrowser() {
  spawn("explorer.exe", [origin], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}
/* main: เปิด checkout นี้ หาเซิร์ฟเวอร์เดิมหรือพอร์ตว่าง แล้วเปิดเว็บของโฟลเดอร์ที่ถูกต้อง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
async function main() {
  const ports = [3000, 3001, 3002, 3003, 3004];
  for (const port of ports) {
    const url = "http://127.0.0.1:" + port;
    const running = await identity(url);
    if (running?.workspaceId === workspaceId) {
      origin = url;
      openBrowser();
      console.log("Ready: " + origin);
      return;
    }
  }
  let selected;
  for (const port of ports) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (free) {
      selected = port;
      break;
    }
  }
  if (!selected)
    throw new Error(
      "Ports 3000-3004 are occupied. Close another local server and retry.",
    );
  origin = "http://127.0.0.1:" + selected;
  const env = {
    ...process.env,
    SARABUN_SOURCE_DIR: workspace,
    SARABUN_LOCAL_DESKTOP: "true",
    SARABUN_PORT: String(selected),
    APP_URL: origin,
  };
  if (!fs.existsSync(path.join(workspace, config.distDir, "BUILD_ID"))) {
    console.log("Preparing this checkout for first use.");
    const build = spawnSync(
      process.execPath,
      ["scripts/run-next.mjs", "build"],
      { cwd: workspace, env, stdio: "inherit" },
    );
    if (build.status !== 0)
      throw new Error("Build failed. Check the message above.");
  }
  fs.mkdirSync("output/local-server", { recursive: true });
  const log = fs.openSync("output/local-server/server.log", "a");
  const child = spawn(process.execPath, ["scripts/run-next.mjs", "start"], {
    cwd: workspace,
    env,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  fs.closeSync(log);
  console.log("Opening Sarabun from " + workspace + " ...");
  for (let i = 0; i < 90; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await identity();
    if (result?.workspaceId === workspaceId) {
      openBrowser();
      console.log("Ready: " + origin);
      return;
    }
  }
  throw new Error(
    "Server did not become ready. See output/local-server/server.log.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
