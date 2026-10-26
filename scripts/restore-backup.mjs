/**
 * แผนที่อ่านโค้ด — scripts/restore-backup.mjs
 * หน้าที่: ตรวจ manifest/hash และ SQLite ก่อนกู้เป็นโฟลเดอร์ใหม่ ไม่ทับปลายทางเดิม
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/backup-manager.tsx
 * 2. ../src/app/backup-actions.ts
 * 3. ../src/lib/backup-catalog.ts
 * 4. ./restore-backup.mjs ← คุณอยู่ที่นี่
 *
 * แนวทางแก้: ตรวจโหมด/path/environment ก่อนรัน สคริปต์บางตัวเขียนไฟล์หรือฐานข้อมูลจริง อ่านเงื่อนไขก่อนเรียก
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { createHash } from "node:crypto";
/* นำเข้า node:sqlite — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { DatabaseSync } from "node:sqlite";
/* นำเข้า node:url — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { pathToFileURL } from "node:url";

/* ตรวจชื่อไฟล์ hash และความสมบูรณ์ SQLite ก่อนกู้ไปโฟลเดอร์ใหม่ ห้ามลดการตรวจนี้เพื่อข้าม error */
export function restoreBackup(source, destination) {
  if (!path.isAbsolute(source) || !path.isAbsolute(destination))
    throw new Error("Use absolute source and destination paths");
  if (fs.existsSync(destination))
    throw new Error(
      "Destination must be a new folder; existing data is never overwritten",
    );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, "manifest.json"), "utf8"),
  );
  if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.files))
    throw new Error("Requires backup schema version 2");
  const names = new Set();
  for (const entry of manifest.files) {
    if (
      typeof entry.name !== "string" ||
      path.basename(entry.name) !== entry.name ||
      /[\\/:]/.test(entry.name) ||
      entry.name === "." ||
      entry.name === ".." ||
      names.has(entry.name)
    )
      throw new Error("Invalid backup filename");
    names.add(entry.name);
    const bytes = fs.readFileSync(path.join(source, entry.name));
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw new Error("Backup checksum mismatch: " + entry.name);
  }
  if (!names.has("sarabun.sqlite")) throw new Error("Database missing");
  const database = new DatabaseSync(path.join(source, "sarabun.sqlite"), {
    readOnly: true,
  });
  try {
    database.exec("PRAGMA trusted_schema=OFF");
    const checks = database.prepare("PRAGMA integrity_check").all();
    if (checks.length !== 1 || Object.values(checks[0])[0] !== "ok")
      throw new Error("Database integrity check failed");
  } finally {
    database.close();
  }
  fs.mkdirSync(destination);
  const data = path.join(destination, "data");
  fs.mkdirSync(data);
  fs.copyFileSync(
    path.join(source, "sarabun.sqlite"),
    path.join(data, "sarabun.sqlite"),
    fs.constants.COPYFILE_EXCL,
  );
  for (const name of [
    "ict.pdf",
    "ict-2569.pdf",
    "equipment.pdf",
    "classification.pdf",
  ])
    if (names.has("budget-reference-" + name)) {
      const refs = path.join(data, "budget-references");
      fs.mkdirSync(refs, { recursive: true });
      fs.copyFileSync(
        path.join(source, "budget-reference-" + name),
        path.join(refs, name),
        fs.constants.COPYFILE_EXCL,
      );
    }
  if (names.has("template-reference-20170502100402.pdf")) {
    const refs = path.join(data, "template-references");
    fs.mkdirSync(refs, { recursive: true });
    fs.copyFileSync(
      path.join(source, "template-reference-20170502100402.pdf"),
      path.join(refs, "20170502100402.pdf"),
      fs.constants.COPYFILE_EXCL,
    );
  }
  fs.writeFileSync(
    path.join(destination, "RESTORE-README.txt"),
    "Restored business data and embedded attachments. Original application remains unchanged. Configure DATABASE_PATH to the restored data/sarabun.sqlite and restore budget references before starting a separate application. Settings and Google OAuth must be configured again. PDF exports can be regenerated.\n",
    { flag: "wx" },
  );
  return { destination, database: path.join(data, "sarabun.sqlite") };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const [, , source, destination] = process.argv;
    if (!source || !destination)
      throw new Error(
        "Usage: node scripts/restore-backup.mjs ABSOLUTE_BACKUP_FOLDER NEW_ABSOLUTE_FOLDER",
      );
    console.log(JSON.stringify(restoreBackup(source, destination), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
