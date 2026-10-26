/**
 * แผนที่อ่านโค้ด — tests/legal-library.test.ts
 * หน้าที่: กรณีทดสอบ legal-library; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/law-library.tsx
 * 2. ../src/app/legal-actions.ts
 * 3. ../src/lib/legal.ts
 * 4. ../src/lib/db.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/app/legal-actions.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
vi.mock("@/lib/storage", () => ({ mirrorLegal: vi.fn() }));
import { beforeAll, afterAll, it, expect, vi } from "vitest";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:os — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import os from "node:os";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/drive", () => ({
  uploadLibraryPdf: vi.fn(async () => "test-drive-id"),
}));
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "../src/lib/db";
/* นำเข้า ../src/app/legal-actions.ts — CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ */
import {
  listLegalReferences,
  saveLegalReference,
  uploadLegalReference,
} from "../src/app/legal-actions";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-law-test-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
});
afterAll(() => db().close());
/* form: กรณีทดสอบ legal-library; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function form(values: Record<string, string>, pdf = false) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    title: "ระเบียบทดสอบ",
    url: "",
    notes: "ใช้ประกอบงาน",
    section: "ข้อ 12",
    ...values,
  }))
    f.set(k, v);
  if (pdf)
    f.set(
      "file",
      new File(["%PDF-1.4 test fixture"], "sample.pdf", {
        type: "application/pdf",
      }),
    );
  return f;
}
it("preserves categorization and PDF during edits from the older drafting form", async () => {
  const id = await saveLegalReference(
    form(
      {
        category: "งานสารบรรณ",
        tags: "เอกสาร, ประชุม",
        highlight: "ข้อควรจำ",
        page: "2",
      },
      true,
    ),
  );
  await saveLegalReference(form({ id, notes: "แก้เฉพาะโน้ต" }));
  const item = (await listLegalReferences()).find((x) => x.id === id)!;
  expect(item.category).toBe("งานสารบรรณ");
  expect(item.highlight).toBe("ข้อควรจำ");
  expect(item.fileName).toBe("sample.pdf");
  await saveLegalReference(
    form({ id, updatedAt: item.updatedAt, notes: "ใหม่" }),
  );
  await expect(
    saveLegalReference(form({ id, updatedAt: item.updatedAt, notes: "เก่า" })),
  ).rejects.toThrow("รายการเปลี่ยนแล้ว");
});
it("rejects invalid file, page and unsafe source URL", async () => {
  const f = form({});
  f.set("file", new File(["not pdf"], "sample.pdf"));
  await expect(saveLegalReference(f)).rejects.toThrow("PDF");
  await expect(saveLegalReference(form({ page: "0" }))).rejects.toThrow();
  await expect(
    saveLegalReference(form({ url: "javascript:alert(1)" })),
  ).rejects.toThrow();
});
it("records successful upload only after service success and clears stale link after replacement", async () => {
  const id = await saveLegalReference(form({}, true));
  await uploadLegalReference(id);
  expect(
    (await listLegalReferences()).find((x) => x.id === id)?.driveFileId,
  ).toBe("test-drive-id");
  await saveLegalReference(form({ id }, true));
  expect(
    (await listLegalReferences()).find((x) => x.id === id)?.driveFileId,
  ).toBe("");
  const noFile = await saveLegalReference(form({}));
  await expect(uploadLegalReference(noFile)).rejects.toThrow("แนบ PDF");
});
