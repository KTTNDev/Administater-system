/**
 * แผนที่อ่านโค้ด — tests/storage.test.ts
 * หน้าที่: กรณีทดสอบ storage; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/system-center.tsx
 * 2. ../src/app/storage-actions.ts
 * 3. ../src/lib/storage.ts
 * 4. ../src/lib/drive.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/backup-catalog.ts, ../src/lib/db.ts, ../src/lib/document.ts, ../src/lib/storage.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { beforeAll, afterAll, it, expect } from "vitest";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:os — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import os from "node:os";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:child_process — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { spawnSync } from "node:child_process";
/* นำเข้า node:sqlite — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { DatabaseSync } from "node:sqlite";
/* นำเข้า ../src/lib/backup-catalog.ts — ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน */
import { backupCatalog, restoreCatalogBackup } from "../src/lib/backup-catalog";
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, setSetting, writeDraft } from "../src/lib/db";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import {
  setStorage,
  storageConfig,
  exportWorkspace,
  safeSegment,
  reportData,
} from "../src/lib/storage";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-storage-test-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(folder, "data.sqlite");
});
afterAll(() => db().close());
it("validates local directory and Drive IDs without accepting relative paths", () => {
  expect(() => setStorage("relative/path", "", "")).toThrow();
  expect(() => setStorage(path.parse(folder).root, "", "")).toThrow();
  expect(() => setStorage(path.join(folder, "files"), "invalid", "")).toThrow();
  setStorage(path.join(folder, "files"), "1234567890abc", "");
  expect(storageConfig().localFolder).toBe(path.join(folder, "files"));
  expect(safeSegment("../../")).not.toContain("/");
});
it("restores verified business data and embedded attachments into a new folder only", () => {
  db().exec(
    "CREATE TABLE IF NOT EXISTS legal_library(id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL)",
  );
  db()
    .prepare("INSERT OR REPLACE INTO legal_library VALUES(?,?,?,?,?)")
    .run(
      "sample-law",
      "{}",
      Buffer.from("%PDF-test"),
      "sample.pdf",
      new Date().toISOString(),
    );
  const result = exportWorkspace(),
    destination = path.join(folder, "restored");
  const run = (dest: string) =>
    spawnSync(
      process.execPath,
      ["scripts/restore-backup.mjs", result.folder, dest],
      { encoding: "utf8" },
    );
  const restored = run(destination);
  expect(restored.status, restored.stderr).toBe(0);
  const copy = new DatabaseSync(
    path.join(destination, "data", "sarabun.sqlite"),
    { readOnly: true },
  );
  try {
    expect(copy.prepare("SELECT count(*) AS n FROM documents").get()?.n).toBe(
      db().prepare("SELECT count(*) AS n FROM documents").get()?.n,
    );
    expect(
      copy
        .prepare("SELECT name FROM sqlite_master WHERE name='settings'")
        .get(),
    ).toBeUndefined();
    const law = copy
      .prepare("SELECT file FROM legal_library WHERE id='sample-law'")
      .get();
    expect(Buffer.from(law!.file as Uint8Array).toString()).toBe("%PDF-test");
  } finally {
    copy.close();
  }
  expect(run(destination).status).toBe(1);
  fs.appendFileSync(path.join(result.folder, "documents.json"), "tampered");
  const corrupt = path.join(folder, "corrupt");
  expect(run(corrupt).status).toBe(1);
  expect(fs.existsSync(corrupt)).toBe(false);
});
it("exports business records and PDF bytes with hashes but excludes settings and credentials", () => {
  setSetting("google:token", "DO_NOT_EXPORT");
  writeDraft({ ...newDraft(), subject: "สำรองตัวอย่าง" });
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS legal_library(id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL)",
  );
  c.prepare("INSERT OR REPLACE INTO legal_library VALUES(?,?,?,?,?)").run(
    "sample-law",
    JSON.stringify({ title: "ตัวอย่าง" }),
    Buffer.from("%PDF-test"),
    "sample.pdf",
    new Date().toISOString(),
  );
  const result = exportWorkspace();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(result.folder, "manifest.json"), "utf8"),
  );
  expect(manifest.counts.documents).toBe(1);
  expect(
    reportData().audit.every(
      (row) => Object.getPrototypeOf(row) === Object.prototype,
    ),
  ).toBe(true);
  expect(
    fs.readFileSync(path.join(result.folder, "sample-law.pdf"), "utf8"),
  ).toBe("%PDF-test");
  const json = fs
    .readdirSync(result.folder)
    .filter((f) => f.endsWith(".json"))
    .map((f) => fs.readFileSync(path.join(result.folder, f), "utf8"))
    .join("");
  expect(json).not.toContain("DO_NOT_EXPORT");
  expect(json).not.toContain('"file":');
  expect(
    manifest.files.every((f: { sha256: string }) => f.sha256.length === 64),
  ).toBe(true);
});
it("lists backups and restores through the catalog without changing the active database", async () => {
  const exported = exportWorkspace(),
    name = path.basename(exported.folder),
    active = storageConfig().database;
  expect(
    backupCatalog().some((item) => item.name === name && item.version === 2),
  ).toBe(true);
  await expect(restoreCatalogBackup("../outside")).rejects.toThrow();
  const result = await restoreCatalogBackup(name);
  expect(fs.existsSync(result.database)).toBe(true);
  expect(storageConfig().database).toBe(active);
});
