/**
 * แผนที่อ่านโค้ด — src/lib/backup-catalog.ts
 * หน้าที่: ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/backup-manager.tsx
 * 2. ../app/backup-actions.ts
 * 3. ./backup-catalog.ts ← คุณอยู่ที่นี่
 * 4. ../../scripts/restore-backup.mjs
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/backup-actions.ts, ../../tests/storage.test.ts
 * อ่านต่อจาก import: ./storage.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { execFile } from "node:child_process";
/* นำเข้า node:util — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { promisify } from "node:util";
/* นำเข้า ./storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { storageConfig } from "./storage";
const execute = promisify(execFile);
const root = () => path.join(storageConfig().localFolder, "สำรองข้อมูล");
/* sourceFor: ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function sourceFor(name: string) {
  if (
    !name ||
    name.length > 150 ||
    name === "." ||
    name === ".." ||
    /[\\/:]/.test(name)
  )
    throw new Error("ชื่อชุดสำรองไม่ถูกต้อง");
  const base = fs.realpathSync.native(root()),
    source = fs.realpathSync.native(path.join(base, name));
  if (path.relative(base, path.dirname(source)) !== "")
    throw new Error("ชุดสำรองต้องอยู่ในโฟลเดอร์สำรองที่ตั้งค่าไว้");
  return source;
}
/* backupCatalog: ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function backupCatalog() {
  if (!fs.existsSync(root())) return [];
  return fs
    .readdirSync(root(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .map((entry) => {
      try {
        const source = sourceFor(entry.name),
          m = JSON.parse(
            fs.readFileSync(path.join(source, "manifest.json"), "utf8"),
          );
        return {
          name: entry.name,
          at: String(m.at || ""),
          version: Number(m.schemaVersion),
          files: Array.isArray(m.files) ? m.files.length : 0,
          documents: Number(m.counts?.documents || 0),
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}
/* restoreCatalogBackup: ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function restoreCatalogBackup(name: string) {
  const source = sourceFor(name);
  const parent = path.join(storageConfig().localFolder, "กู้คืนข้อมูล");
  fs.mkdirSync(parent, { recursive: true });
  const destination = path.join(
    parent,
    new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      randomUUID().slice(0, 8),
  );
  const script = path.join(
    process.env.SARABUN_SOURCE_DIR || process.cwd(),
    "scripts",
    "restore-backup.mjs",
  );
  try {
    await execute(process.execPath, [script, source, destination], {
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error(
      "กู้คืนไม่สำเร็จ: ตรวจว่าชุดสำรองเป็นรุ่น 2 ไฟล์ครบและไม่เสียหาย และพื้นที่ปลายทางเขียนได้",
    );
  }
  return {
    folder: destination,
    database: path.join(destination, "data", "sarabun.sqlite"),
  };
}
