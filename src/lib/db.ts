/**
 * แผนที่อ่านโค้ด — src/lib/db.ts
 * หน้าที่: ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ../components/workspace.tsx
 * 3. ./document.ts
 * 4. ../app/actions.ts
 * 5. ./db.ts ← คุณอยู่ที่นี่
 * 6. ./render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ./pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/actions.ts, ../app/api/documents/[id]/pdf/route.ts, ../app/api/google/callback/route.ts, ../app/api/legal/[id]/route.ts, ../app/legal-actions.ts, ../app/page.tsx, ../app/storage-actions.ts, ./appendix.ts (และจุดอื่นที่ค้นชื่อ export ได้ใน IDE)
 * อ่านต่อจาก import: ./document.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:sqlite — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { DatabaseSync } from "node:sqlite";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema, type Draft, type SavedDraft } from "./document";
/* คลาส wrapper ครอบ DatabaseSync ของ Node: private จำกัดการเข้าถึงใน TypeScript, readonly กันการชี้ connection ไปตัวใหม่; ไม่ได้ทำให้ข้อมูลในฐานข้อมูลเป็น read-only */
class SQLiteDatabase {
  private readonly connection: DatabaseSync;
  /* constructor ทำงานเมื่อ new SQLiteDatabase(file); this.connection คือ connection ของ instance นี้ */
  constructor(file: string) {
    this.connection = new DatabaseSync(file);
  }
  /* เตรียมคำสั่ง SQL ที่มี ? แล้วใช้ .get/.all/.run ส่งค่าภายหลัง; ไม่ต่อข้อความผู้ใช้ลง SQL โดยตรง */
  prepare(sql: string) {
    return this.connection.prepare(sql);
  }
  /* ส่ง SQL ที่ไม่ต้องอ่านแถวผลลัพธ์ เช่น CREATE TABLE; ถ้า SQL มีค่าจากผู้ใช้ให้ใช้ prepare กับ placeholders */
  exec(sql: string) {
    this.connection.exec(sql);
  }
  /* ตั้งค่าพฤติกรรม SQLite ภายในแอป ค่าที่ส่งมาควรเป็นค่าที่ผู้พัฒนากำหนด ไม่รับ SQL อิสระจากผู้ใช้ */
  pragma(statement: string) {
    this.connection.exec(`PRAGMA ${statement}`);
  }
  /* คืน connection เมื่อเลิกใช้ โดยเฉพาะฐานข้อมูลชั่วคราวใน tests */
  close() {
    this.connection.close();
  }
  /* Generic T คือชนิดผลลัพธ์ของงานที่ส่งเข้ามา; คืนฟังก์ชันอีกชั้น จึงเห็นการเรียก db().transaction(() => {...})() ในส่วนบันทึก */
  transaction<T>(operation: () => T): () => T {
    return () => {
      /* จองการเขียนก่อนเริ่มชุดคำสั่ง: เขียนเอกสารและ audit ให้สำเร็จพร้อมกัน หรือย้อนทั้งหมดเมื่อผิดพลาด */
      this.connection.exec("BEGIN IMMEDIATE");
      /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
      try {
        const result = operation();
        /* ยืนยันคำสั่งทั้งหมดใน transaction เมื่อ operation ไม่ throw */
        this.connection.exec("COMMIT");
        return result;
      } catch (error) {
        /* ยกเลิกชุดคำสั่งที่ทำไว้ใน transaction นี้ เพื่อไม่ให้มีเอกสารที่เปลี่ยนแล้วแต่ประวัติยังไม่ครบ */
        this.connection.exec("ROLLBACK");
        throw error;
      }
    };
  }
}
/* as unknown as ... เป็นการบอกชนิดให้ compiler รู้จักช่อง sarabunDb บน globalThis ไม่ได้ตรวจหรือสร้าง connection จริง; db() ด้านล่างเป็นผู้สร้าง */
const globalDb = globalThis as unknown as { sarabunDb?: SQLiteDatabase };
/* คืน connection เดิมถ้ามี มิฉะนั้นเปิด SQLite และสร้างตาราง; globalThis ช่วยไม่เปิด connection ซ้ำตอน dev reload */
export function db() {
  if (globalDb.sarabunDb) return globalDb.sarabunDb;
  const file = path.resolve(
    process.env.SARABUN_SOURCE_DIR || process.cwd(),
    process.env.DATABASE_PATH || "data/sarabun.sqlite",
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new SQLiteDatabase(file);
  /* WAL แยกบันทึกการเขียนจากไฟล์หลัก ช่วยให้การอ่าน/เขียนทำงานร่วมกันได้; สำรองข้อมูลต้องใช้วิธีที่คำนึงถึง transaction/WAL */
  conn.pragma("journal_mode = WAL");
  /* รอ lock ฐานข้อมูลได้สูงสุด 5 วินาที แทนการล้มเหลวทันทีเมื่อมีงานเขียนอื่น */
  conn.pragma("busy_timeout = 5000");
  conn.exec(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, drive_file_id TEXT, synced_version INTEGER
  );
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, action TEXT NOT NULL, version INTEGER, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS documents_updated ON documents(updated_at DESC);`);
  globalDb.sarabunDb = conn;
  return conn;
}
/* ชนิด Row: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Row = {
  id: string;
  data: string;
  version: number;
  created_at: string;
  updated_at: string;
  drive_file_id: string | null;
  synced_version: number | null;
};
/* JSON.parse อ่านข้อมูลที่เก็บเป็นข้อความ แล้ว Zod เติม default/ตรวจรูปแบบก่อนรวม metadata ของแถว */
function decode(row: Row): SavedDraft {
  return {
    ...documentSchema.parse(JSON.parse(row.data)),
    id: row.id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    driveFileId: row.drive_file_id,
    syncedVersion: row.synced_version,
  };
}
/* อ่านตามเวลาแก้ล่าสุดและ decode ทุกแถว; หากเพิ่มตัวกรองระดับฐานข้อมูลให้แก้ query ที่นี่ */
export function listDrafts(): SavedDraft[] {
  return (
    db()
      .prepare("SELECT * FROM documents ORDER BY updated_at DESC")
      .all() as Row[]
  ).map(decode);
}
/* ใช้ placeholder ? ส่ง id แยกจาก SQL; ไม่พบแถวจะ throw ให้ชั้น action/route ตัดสินใจแสดงข้อผิดพลาด */
export function readDraft(id: string) {
  const row = db().prepare("SELECT * FROM documents WHERE id = ?").get(id) as
    | Row
    | undefined;
  if (!row) throw new Error("ไม่พบร่างหนังสือ");
  return decode(row);
}
/* บันทึกเอกสารและ audit ใน transaction เดียว; UPDATE ต้องตรงทั้ง id และ version จึงสำเร็จ */
export function writeDraft(input: Draft, id?: string, version?: number) {
  /* ตรวจ/แปลง data จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
  const data = JSON.stringify(documentSchema.parse(input));
  const now = new Date().toISOString();
  return db().transaction(() => {
    const key = id || randomUUID();
    if (id) {
      const result = db()
        .prepare(
          "UPDATE documents SET data=?, version=version+1, updated_at=? WHERE id=? AND version=?",
        )
        .run(data, now, id, version ?? -1);
      if (!result.changes)
        throw new Error(
          "ร่างนี้ถูกแก้ไขหรือลบจากหน้าต่างอื่นแล้ว กรุณาเปิดร่างล่าสุดก่อนบันทึก",
        );
    } else
      db()
        .prepare(
          "INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)",
        )
        .run(key, data, now, now);
    /* อ่านค่าที่เพิ่งเขียนกลับมาเพื่อให้ version/เวลาใน UI ตรงกับฐานข้อมูลจริง */
    const saved = readDraft(key);
    db()
      .prepare(
        "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
      )
      .run(key, id ? "update" : "create", saved.version, now);
    return saved;
  })();
}
/* ลบร่างเฉพาะ version ที่ผู้ใช้เปิดอยู่ แล้วลง audit ใน transaction เดียวกัน */
export function removeDraft(id: string, version: number) {
  db().transaction(() => {
    const result = db()
      .prepare("DELETE FROM documents WHERE id=? AND version=?")
      .run(id, version);
    if (!result.changes)
      throw new Error("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่");
    db()
      .prepare(
        "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
      )
      .run(id, "delete", version, new Date().toISOString());
  })();
}
/* อ่านค่าตั้งค่าหนึ่ง key; optional chaining คืน undefined เมื่อยังไม่เคยตั้งค่า */
export function getSetting(key: string) {
  return (
    db().prepare("SELECT value FROM settings WHERE key=?").get(key) as
      | { value: string }
      | undefined
  )?.value;
}
/* INSERT ... ON CONFLICT คือเพิ่มเมื่อยังไม่มี และอัปเดตเมื่อมี key อยู่แล้ว */
export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, value);
}
/* อ่านเหตุการณ์ล่าสุดของร่าง จำกัดจำนวนเพื่อไม่ส่งข้อมูลย้อนหลังทั้งหมดไปหน้าเว็บ */
export function auditHistory(id: string) {
  return db()
    .prepare(
      "SELECT action,version,at FROM audit WHERE document_id=? ORDER BY id DESC LIMIT 40",
    )
    .all(id) as { action: string; version: number; at: string }[];
}
