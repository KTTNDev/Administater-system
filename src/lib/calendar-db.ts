/**
 * แผนที่อ่านโค้ด — src/lib/calendar-db.ts
 * หน้าที่: เก็บนัดหมายและตรวจเอกสาร/งานธุรการที่เชื่อมโยงก่อนบันทึก
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./calendar.ts
 * 2. ../components/work-calendar.tsx
 * 3. ../app/calendar-actions.ts
 * 4. ./calendar-db.ts ← คุณอยู่ที่นี่
 * 5. ./db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/calendar-actions.ts, ../app/page.tsx, ../../tests/calendar.test.ts
 * อ่านต่อจาก import: ./db.ts, ./calendar.ts
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
/* นำเข้า ./calendar.ts — กฎข้อมูลนัดหมายและตัวช่วยเลือกเหตุการณ์ที่เกิดในแต่ละวัน */
import { calendarSchema, type CalendarEvent } from "./calendar";
/* เตรียมตารางของโมดูลนี้บน connection กลางจาก db.ts แล้วคืนตัวเชื่อมพร้อมใช้ */
function connection() {
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS calendar_events(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL)",
  );
  return c;
}
/* อ่านนัดหมายและ parse แต่ละรายการตาม calendarSchema */
export function listCalendar(): CalendarEvent[] {
  return connection()
    .prepare("SELECT * FROM calendar_events ORDER BY id")
    .all()
    .map((r) => ({
      ...calendarSchema.parse(JSON.parse(String(r.data))),
      id: String(r.id),
      version: Number(r.version),
    }));
}
/* ตรวจหนังสือ/ทะเบียนต้นทางที่เลือกไว้ แล้วบันทึกนัดหมายพร้อม version และ audit */
export function writeCalendar(input: unknown, id?: string, version?: number) {
  const data = calendarSchema.parse(input),
    c = connection(),
    key = id || randomUUID();
  c.transaction(() => {
    if (
      data.documentId &&
      !c.prepare("SELECT id FROM documents WHERE id=?").get(data.documentId)
    )
      throw new Error("ไม่พบหนังสือที่เลือก กรุณาเลือกใหม่");
    if (
      data.sourceOfficeId &&
      !c
        .prepare("SELECT id FROM office_items WHERE id=?")
        .get(data.sourceOfficeId)
    )
      throw new Error("ไม่พบทะเบียนต้นทาง กรุณาเลือกใหม่");
    if (id) {
      if (
        !c
          .prepare(
            "UPDATE calendar_events SET data=?,version=version+1 WHERE id=? AND version=?",
          )
          .run(JSON.stringify(data), id, version ?? -1).changes
      )
        throw new Error("รายการเปลี่ยนแล้ว กรุณาปิดฟอร์มและโหลดใหม่ก่อนแก้ไข");
    } else
      c.prepare("INSERT INTO calendar_events VALUES(?,?,1)").run(
        key,
        JSON.stringify(data),
      );
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(
      key,
      id ? "calendar_update" : "calendar_create",
      id ? (version ?? 0) + 1 : 1,
      new Date().toISOString(),
    );
  })();
  return key;
}
