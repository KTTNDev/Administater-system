/**
 * แผนที่อ่านโค้ด — tests/office.test.ts
 * หน้าที่: กรณีทดสอบ office; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/office.ts
 * 2. ../src/components/office-workspace.tsx
 * 3. ../src/app/office-actions.ts
 * 4. ../src/lib/office-db.ts
 * 5. ../src/lib/db.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/office.ts, ../src/lib/office-db.ts
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
/* นำเข้า ../src/lib/office.ts — กฎข้อมูลทะเบียนงานธุรการ ชนิดงาน สถานะ และข้อมูลหนังสือที่เชื่อมโยง */
import { officeSchema, officeKinds } from "../src/lib/office";
/* นำเข้า ../src/lib/office-db.ts — อ่านเขียนทะเบียนงานธุรการ ตรวจร่างหนังสืออ้างอิงและ version ก่อนแก้ไข */
import { writeOffice, listOffice, deleteOffice } from "../src/lib/office-db";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "sarabun-office-test-"),
);
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
});
afterAll(() => db().close());
it("persists all office categories and records updates and deletion", () => {
  for (const kind of Object.keys(officeKinds))
    writeOffice({ kind, title: `ทดสอบ ${kind}` });
  expect(listOffice()).toHaveLength(7);
  const item = listOffice()[0];
  writeOffice({ ...item, notes: "ติดตามผลแล้ว" }, item.id, item.version);
  expect(listOffice().find((i) => i.id === item.id)?.notes).toBe(
    "ติดตามผลแล้ว",
  );
  expect(() =>
    writeOffice({ ...item, title: "ข้อมูลเก่า" }, item.id, 1),
  ).toThrow();
  expect(() => deleteOffice(item.id, 1)).toThrow();
  deleteOffice(item.id, 2);
  expect(auditHistory(item.id)[0].action).toBe("office_delete");
  expect(listOffice()).toHaveLength(6);
});
it("rejects invalid dates, unsafe URLs, negative stock and nonexistent document links", () => {
  expect(
    officeSchema.safeParse({ kind: "task", title: "งาน", due: "2026-02-30" })
      .success,
  ).toBe(false);
  expect(
    officeSchema.safeParse({
      kind: "contact",
      title: "ผู้ติดต่อ",
      url: "javascript:alert(1)",
    }).success,
  ).toBe(false);
  expect(
    officeSchema.safeParse({ kind: "supplies", title: "กระดาษ", quantity: -1 })
      .success,
  ).toBe(false);
  expect(() =>
    writeOffice({
      kind: "task",
      title: "งาน",
      documentId: "00000000-0000-4000-8000-999999999999",
    }),
  ).toThrow();
});
