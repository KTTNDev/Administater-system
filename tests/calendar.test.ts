/**
 * แผนที่อ่านโค้ด — tests/calendar.test.ts
 * หน้าที่: กรณีทดสอบ calendar; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/calendar.ts
 * 2. ../src/components/work-calendar.tsx
 * 3. ../src/app/calendar-actions.ts
 * 4. ../src/lib/calendar-db.ts
 * 5. ../src/lib/db.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/calendar.ts, ../src/lib/calendar-db.ts, ../src/lib/office-db.ts
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
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, auditHistory } from "../src/lib/db";
/* นำเข้า ../src/lib/calendar.ts — กฎข้อมูลนัดหมายและตัวช่วยเลือกเหตุการณ์ที่เกิดในแต่ละวัน */
import { blankEvent, calendarSchema, onDay } from "../src/lib/calendar";
/* นำเข้า ../src/lib/calendar-db.ts — เก็บนัดหมายและตรวจเอกสาร/งานธุรการที่เชื่อมโยงก่อนบันทึก */
import { listCalendar, writeCalendar } from "../src/lib/calendar-db";
/* นำเข้า ../src/lib/office-db.ts — อ่านเขียนทะเบียนงานธุรการ ตรวจร่างหนังสืออ้างอิงและ version ก่อนแก้ไข */
import { writeOffice } from "../src/lib/office-db";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "sarabun-calendar-test-"),
);
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
});
afterAll(() => db().close());
it("validates real dates, ordered ranges and safe attachment URLs", () => {
  const e = { ...blankEvent("2026-09-13"), title: "ประชุม" };
  expect(calendarSchema.safeParse({ ...e, date: "2026-02-30" }).success).toBe(
    false,
  );
  expect(
    calendarSchema.safeParse({ ...e, endDate: "2026-09-12" }).success,
  ).toBe(false);
  expect(calendarSchema.safeParse({ ...e, end: "08:00" }).success).toBe(false);
  expect(
    calendarSchema.safeParse({ ...e, allDay: true, end: "08:00" }).success,
  ).toBe(true);
  expect(
    calendarSchema.safeParse({
      ...e,
      attachments: [{ name: "ไฟล์", url: "javascript:alert(1)" }],
    }).success,
  ).toBe(false);
  expect(onDay({ ...e, endDate: "2026-09-15" }, "2026-09-14")).toBe(true);
  expect(onDay({ ...e, endDate: "2026-09-15" }, "2026-09-16")).toBe(false);
});
it("persists source and attachments, rejects stale changes and missing sources", () => {
  const sourceOfficeId = writeOffice({ kind: "incoming", title: "เชิญประชุม" });
  const input = {
    ...blankEvent("2026-09-13"),
    title: "ประชุมตามหนังสือ",
    sourceOfficeId,
    attachments: [
      { name: "หนังสือเชิญ", url: "https://example.org/invitation.pdf" },
    ],
  };
  const id = writeCalendar(input),
    saved = listCalendar().find((e) => e.id === id)!;
  expect(saved.attachments).toEqual(input.attachments);
  expect(saved.sourceOfficeId).toBe(sourceOfficeId);
  writeCalendar({ ...saved, status: "cancelled" }, id, saved.version);
  expect(() =>
    writeCalendar({ ...saved, title: "เก่า" }, id, saved.version),
  ).toThrow();
  expect(listCalendar().find((e) => e.id === id)?.status).toBe("cancelled");
  expect(auditHistory(id).some((e) => e.action === "calendar_update")).toBe(
    true,
  );
  expect(() =>
    writeCalendar({
      ...input,
      documentId: "00000000-0000-4000-8000-999999999999",
    }),
  ).toThrow();
  expect(() =>
    writeCalendar({
      ...input,
      sourceOfficeId: "00000000-0000-4000-8000-999999999999",
    }),
  ).toThrow();
  expect(listCalendar()).toHaveLength(1);
});
