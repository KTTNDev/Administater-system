/**
 * แผนที่อ่านโค้ด — tests/recovery.test.ts
 * หน้าที่: กรณีทดสอบ recovery; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/recovery-panel.tsx
 * 2. ../src/app/recovery-actions.ts
 * 3. ../src/lib/recovery.ts
 * 4. ../src/lib/document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/document.ts, ../src/lib/budget.ts, ../src/lib/recovery.ts
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
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "../src/lib/db";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/budget.ts — กฎคำขอโอนงบ รายการโอนลด/เพิ่ม การคำนวณยอด และการตรวจความครบถ้วน */
import { newBudget } from "../src/lib/budget";
/* นำเข้า ../src/lib/recovery.ts — เก็บร่างกู้คืนของฟอร์ม แยกจากเอกสารที่ผู้ใช้กดบันทึกจริง */
import { storeRecovery, listRecovery, readRecovery } from "../src/lib/recovery";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-recovery-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(folder, "test.sqlite");
});
afterAll(() => db().close());
it("stores incomplete drafts without modifying the document registry and ignores late writes", () => {
  const id = randomUUID();
  storeRecovery({
    id,
    scope: "document",
    sequence: 2,
    data: { ...newDraft(), subject: "", body: "ข้อความล่าสุด" },
  });
  storeRecovery({
    id,
    scope: "document",
    sequence: 1,
    data: { ...newDraft(), body: "เก่า" },
  });
  expect(
    (readRecovery(id, "document") as ReturnType<typeof newDraft>).body,
  ).toBe("ข้อความล่าสุด");
  expect(
    db().prepare("SELECT count(*) AS count FROM documents").get()?.count,
  ).toBe(0);
  expect(listRecovery("document")).toHaveLength(1);
  expect(() => readRecovery(id, "budget")).toThrow();
});
it("recovers budget requests and validates incoming structure", () => {
  const id = randomUUID(),
    data = newBudget("2026-09-16");
  storeRecovery({ id, scope: "budget", sequence: 1, data });
  expect(readRecovery(id, "budget")).toEqual(data);
  expect(() =>
    storeRecovery({ id, scope: "budget", sequence: 2, data: { bad: true } }),
  ).toThrow();
});
