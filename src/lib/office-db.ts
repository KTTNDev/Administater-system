/**
 * แผนที่อ่านโค้ด — src/lib/office-db.ts
 * หน้าที่: อ่านเขียนทะเบียนงานธุรการ ตรวจร่างหนังสืออ้างอิงและ version ก่อนแก้ไข
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./office.ts
 * 2. ../components/office-workspace.tsx
 * 3. ../app/office-actions.ts
 * 4. ./office-db.ts ← คุณอยู่ที่นี่
 * 5. ./db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/office-actions.ts, ../app/page.tsx, ../../tests/calendar.test.ts, ../../tests/office.test.ts
 * อ่านต่อจาก import: ./db.ts, ./office.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า ./db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "./db";
/* นำเข้า ./office.ts — กฎข้อมูลทะเบียนงานธุรการ ชนิดงาน สถานะ และข้อมูลหนังสือที่เชื่อมโยง */
import { officeSchema, type OfficeItem } from "./office";
/* เตรียมตารางของโมดูลนี้บน connection กลางจาก db.ts แล้วคืนตัวเชื่อมพร้อมใช้ */
function connection() {
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS office_items(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)",
  );
  return c;
}
/* อ่านทะเบียนงานธุรการตามเวลาแก้ล่าสุดและ parse ข้อมูลก่อนส่ง UI */
export function listOffice(): OfficeItem[] {
  return connection()
    .prepare("SELECT * FROM office_items ORDER BY updated_at DESC,id")
    .all()
    .map((row) => ({
      ...officeSchema.parse(JSON.parse(String(row.data))),
      id: String(row.id),
      version: Number(row.version),
      updatedAt: String(row.updated_at),
    }));
}
/* ตรวจเอกสารที่เชื่อมโยงแล้วเพิ่ม/แก้ทะเบียนใน transaction พร้อม audit */
export function writeOffice(input: unknown, id?: string, version?: number) {
  const data = officeSchema.parse(input),
    c = connection(),
    key = id || randomUUID(),
    now = new Date().toISOString();
  c.transaction(() => {
    if (
      data.documentId &&
      !c.prepare("SELECT id FROM documents WHERE id=?").get(data.documentId)
    )
      throw new Error("ไม่พบหนังสือที่เชื่อมโยง กรุณาเลือกใหม่");
    if (id) {
      if (
        !c
          .prepare(
            "UPDATE office_items SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .run(JSON.stringify(data), now, id, version ?? -1).changes
      )
        throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข");
    } else
      c.prepare("INSERT INTO office_items VALUES(?,?,1,?)").run(
        key,
        JSON.stringify(data),
        now,
      );
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(
      key,
      id ? "office_update" : "office_create",
      id ? (version ?? 0) + 1 : 1,
      now,
    );
  })();
  return key;
}
/* ลบทะเบียนเมื่อ version ยังตรงกับที่ผู้ใช้เปิด พร้อมเก็บเหตุการณ์ลบ */
export function deleteOffice(id: string, version: number) {
  const c = connection();
  c.transaction(() => {
    if (
      !c
        .prepare("DELETE FROM office_items WHERE id=? AND version=?")
        .run(id, version).changes
    )
      throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(id, "office_delete", version, new Date().toISOString());
  })();
}
