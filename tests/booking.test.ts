/**
 * แผนที่อ่านโค้ด — tests/booking.test.ts
 * หน้าที่: กรณีทดสอบ booking; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/booking.ts
 * 2. ../src/components/meeting-bookings.tsx
 * 3. ../src/app/booking-actions.ts
 * 4. ../src/lib/booking-db.ts
 * 5. ../src/lib/db.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/document.ts, ../src/lib/booking.ts, ../src/lib/booking-db.ts
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
/* นำเข้า node:worker_threads — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { Worker } from "node:worker_threads";
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, auditHistory, writeDraft } from "../src/lib/db";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/booking.ts — กฎการจองห้อง ช่วงเวลา ความจุ และตัวช่วยวันที่/ตรวจช่วงเวลาทับกัน */
import { bookingSchema, clashes } from "../src/lib/booking";
/* นำเข้า ../src/lib/booking-db.ts — เก็บห้องและการจอง มี transaction และ trigger ป้องกันการจองซ้อนถึงระดับ SQLite */
import {
  bookingSnapshot,
  saveRoom,
  saveBooking,
  cancelBooking,
} from "../src/lib/booking-db";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "sarabun-booking-test-"),
);
const file = path.join(directory, "test.sqlite");
beforeAll(() => {
  process.env.DATABASE_PATH = file;
});
afterAll(() => db().close());
const room = (name: string) =>
  saveRoom({ name, capacity: 20, bufferMinutes: 15 });
const slot = (roomId: string, start = "09:00", end = "10:00") => ({
  roomId,
  title: "ประชุมทดสอบ",
  organizer: "ผู้ประสานงาน",
  date: "2026-10-01",
  start,
  end,
  attendees: 10,
});
it("rejects invalid dates, reverse times, cross-midnight and insufficient capacity", () => {
  const id = room("ตรวจข้อมูล");
  expect(
    bookingSchema.safeParse({ ...slot(id), date: "2026-02-30" }).success,
  ).toBe(false);
  expect(() => saveBooking(slot(id, "10:00", "09:00"))).toThrow();
  expect(() => saveBooking(slot(id, "23:30", "23:50"))).toThrow();
  expect(() => saveBooking({ ...slot(id), attendees: 21 })).toThrow();
  expect(() =>
    saveBooking({
      ...slot(id),
      documentId: "00000000-0000-4000-8000-999999999999",
    }),
  ).toThrow();
});
it("blocks overlapping and contained intervals including cleanup, allows adjacent slots and other rooms", () => {
  const a = room("ห้องหนึ่ง"),
    b = room("ห้องสอง");
  saveBooking(slot(a));
  for (const [start, end] of [
    ["08:30", "09:30"],
    ["09:15", "09:45"],
    ["08:00", "11:00"],
    ["10:00", "10:30"],
  ])
    expect(() => saveBooking(slot(a, start, end))).toThrow();
  expect(() => saveBooking(slot(a, "10:15", "11:00"))).not.toThrow();
  expect(() => saveBooking(slot(b))).not.toThrow();
  const snapshot = bookingSnapshot();
  expect(
    clashes(snapshot.bookings, a, "2026-10-01", "08:30", "09:00", 15),
  ).toHaveLength(1);
});
it("rolls back failed moves, preserves audit and prevents stale edits/cancellations", () => {
  const r = room("แก้ไขรายการ"),
    a = saveBooking(slot(r)),
    b = saveBooking(slot(r, "11:00", "12:00"));
  expect(() => saveBooking(slot(r), b, 1)).toThrow();
  expect(bookingSnapshot().bookings.find((x) => x.id === b)?.start).toBe(
    "11:00",
  );
  saveBooking({ ...slot(r), title: "แก้หัวข้อ" }, a, 1);
  expect(() => saveBooking(slot(r), a, 1)).toThrow();
  expect(() => cancelBooking(a, 1, "เก่า")).toThrow();
  cancelBooking(a, 2, "เลื่อนประชุม");
  expect(
    bookingSnapshot().bookings.find((x) => x.id === a)?.cancellationReason,
  ).toBe("เลื่อนประชุม");
  expect(auditHistory(a)[0].action).toBe("booking_cancel");
  expect(() => saveBooking(slot(r))).not.toThrow();
  expect(() => saveBooking(slot(r), a, 3)).toThrow();
});
it("preserves old bookings on room closure and supports document links", () => {
  const r = room("ปิดรับจอง"),
    d = writeDraft(newDraft());
  saveBooking({ ...slot(r), documentId: d.id });
  saveRoom({ name: "ปิดรับจอง", capacity: 20, active: false }, r, 1);
  expect(() => saveBooking(slot(r, "13:00", "14:00"))).toThrow();
  expect(
    bookingSnapshot().bookings.find((b) => b.roomId === r)?.documentId,
  ).toBe(d.id);
  expect(() => saveRoom({ name: "ปิดรับจอง", capacity: 30 })).toThrow();
});
it("allows exactly one simultaneous writer for the same room slot", async () => {
  const roomId = room("ทดสอบพร้อมกัน");
  const workerCode = `const {parentPort,workerData}=require('node:worker_threads'); const {DatabaseSync}=require('node:sqlite'); const {randomUUID}=require('node:crypto'); const c=new DatabaseSync(workerData.file); c.exec('PRAGMA busy_timeout=5000'); parentPort.postMessage('ready'); parentPort.once('message',()=>{try{c.prepare("INSERT INTO room_bookings VALUES(?,?,?,?,?,'booked',?,1,?)").run(randomUUID(),workerData.roomId,'2026-10-02',540,615,JSON.stringify(workerData.data),new Date().toISOString());parentPort.postMessage('saved');}catch(e){parentPort.postMessage(e.message.includes('ซ้อน')?'conflict':e.message);}finally{c.close();parentPort.close();}});`;
  const workers = [0, 1].map(
    () =>
      new Worker(workerCode, {
        eval: true,
        workerData: {
          file,
          roomId,
          data: {
            ...slot(roomId),
            date: "2026-10-02",
            bufferMinutes: 15,
            cancellationReason: "",
          },
        },
      }),
  );
  const ready = workers.map(
    (w) =>
      new Promise<void>((resolve, reject) => {
        w.once("error", reject);
        w.once("message", () => resolve());
      }),
  );
  await Promise.all(ready);
  const finished = workers.map(
    (w) =>
      new Promise<string>((resolve, reject) => {
        w.once("error", reject);
        w.once("message", resolve);
      }),
  );
  workers.forEach((w) => w.postMessage("go"));
  expect((await Promise.all(finished)).sort()).toEqual(["conflict", "saved"]);
  expect(
    bookingSnapshot().bookings.filter((b) => b.roomId === roomId),
  ).toHaveLength(1);
});
