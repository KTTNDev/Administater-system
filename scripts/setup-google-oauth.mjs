/**
 * แผนที่อ่านโค้ด — scripts/setup-google-oauth.mjs
 * หน้าที่: เตรียมการตั้งค่าเชื่อม Google OAuth สำหรับเครื่องที่ใช้งาน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/system-center.tsx
 * 2. ../src/app/storage-actions.ts
 * 3. ../src/lib/storage.ts
 * 4. ../src/lib/drive.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomBytes } from "node:crypto";
const envPath = path.resolve(".env.local");
let env = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
  : "";
/* read: เตรียมการตั้งค่าเชื่อม Google OAuth สำหรับเครื่องที่ใช้งาน */
function read(key) {
  const line = env.split(/\r?\n/).find((l) => l.startsWith(key + "="));
  if (!line) return "";
  const value = line.slice(key.length + 1).trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.replace(/^'|'$/g, "");
}
/* set: เตรียมการตั้งค่าเชื่อม Google OAuth สำหรับเครื่องที่ใช้งาน */
function set(key, value) {
  if (/[\r\n]/.test(value)) throw new Error("Invalid multiline configuration");
  const line = key + "=" + JSON.stringify(value);
  const lines = env.split(/\r?\n/);
  let found = false;
  env = lines
    .map((l) => {
      if (l.startsWith(key + "=")) {
        found = true;
        return line;
      }
      return l;
    })
    .join("\n");
  if (!found) env += "\n" + line;
}
const origin = read("APP_URL") || "http://127.0.0.1:3000";
const parsed = new URL(origin);
if (parsed.pathname !== "/" || parsed.search || parsed.hash)
  throw new Error("APP_URL must be an origin");
const callback = parsed.origin + "/api/google/callback";
const input = process.argv[2];
if (input && input !== "--prepare") {
  const credentials = JSON.parse(
    fs.readFileSync(path.resolve(input), "utf8").replace(/^\uFEFF/, ""),
  );
  const web = credentials.web;
  if (
    !web ||
    typeof web.client_id !== "string" ||
    !web.client_id.endsWith(".apps.googleusercontent.com") ||
    typeof web.client_secret !== "string" ||
    !web.client_secret
  )
    throw new Error(
      "Use the Web application OAuth client JSON downloaded from Google Cloud",
    );
  if (
    !Array.isArray(web.redirect_uris) ||
    !web.redirect_uris.includes(callback)
  )
    throw new Error("Client redirect URI must include " + callback);
  set("GOOGLE_CLIENT_ID", web.client_id);
  set("GOOGLE_CLIENT_SECRET", web.client_secret);
}
if (!read("SESSION_SECRET"))
  set("SESSION_SECRET", randomBytes(48).toString("hex"));
if (!read("APP_URL")) set("APP_URL", parsed.origin);
const temp = envPath + "." + randomBytes(6).toString("hex");
fs.writeFileSync(temp, env.trimEnd() + "\n", { flag: "wx", mode: 0o600 });
fs.renameSync(temp, envPath);
console.log(
  JSON.stringify({
    prepared: true,
    oauthConfigured: !!(
      read("GOOGLE_CLIENT_ID") && read("GOOGLE_CLIENT_SECRET")
    ),
    callback,
    envFile: envPath,
    secretsPrinted: false,
  }),
);
