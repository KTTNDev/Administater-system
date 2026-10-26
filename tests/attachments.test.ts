/**
 * แผนที่อ่านโค้ด — tests/attachments.test.ts
 * หน้าที่: กรณีทดสอบ attachments; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/document.ts
 * 2. ../src/components/attachment-editor.tsx
 * 3. ../src/app/attachment-actions.ts
 * 4. ../src/lib/attachments.ts
 * 5. ../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/attachments.ts, ../src/lib/document.ts, ../src/lib/render-document.ts, ../src/lib/storage.ts
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
import { PDFDocument } from "pdf-lib";
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, setSetting, writeDraft, readDraft } from "../src/lib/db";
/* นำเข้า ../src/lib/attachments.ts — รับ PDF/ภาพ ตรวจเนื้อไฟล์ เก็บต้นฉบับและฉบับสำหรับพิมพ์ แล้วรวมท้าย PDF ของหนังสือ */
import {
  createAttachment,
  readAttachment,
  validateAttachments,
  appendAttachments,
} from "../src/lib/attachments";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema, newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
/* นำเข้า ../src/lib/storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { exportWorkspace } from "../src/lib/storage";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-attachments-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
  setSetting("storage:local", path.join(dir, "files"));
});
afterAll(() => db().close());
it("stores actual PDFs, preserves page order and sizes, persists draft references and backs up bytes", async () => {
  const source = await PDFDocument.create();
  source.addPage([321, 456]);
  source.addPage([456, 321]);
  const a = await createAttachment(
    new File([new Uint8Array(await source.save())], "schedule.pdf"),
  );
  const draft = {
    ...newDraft("internal"),
    attachmentFiles: [{ ...a, showNameInDocument: false }],
  };
  validateAttachments(draft);
  expect(readAttachment(a.id).original).toEqual(
    Buffer.from(await source.save()),
  );
  const saved = readDraft(writeDraft(draft).id).attachmentFiles[0];
  expect(saved.id).toBe(a.id);
  expect(saved.showNameInDocument).toBe(false);
  const cover = await PDFDocument.create();
  cover.addPage([595, 842]);
  const merged = await PDFDocument.load(
    await appendAttachments(Buffer.from(await cover.save()), draft),
  );
  expect(merged.getPages().map((p) => p.getWidth())).toEqual([595, 321, 456]);
  const backup = exportWorkspace();
  expect(fs.readFileSync(path.join(backup.folder, a.id + ".pdf"))).toEqual(
    readAttachment(a.id).file,
  );
  expect(() =>
    validateAttachments({ ...draft, attachmentFiles: [{ ...a, bytes: 1 }] }),
  ).toThrow();
  expect(() =>
    validateAttachments({ ...draft, attachmentFiles: [a, a] }),
  ).toThrow();
});
it("rejects fake files and encrypted or broken PDFs before storing", async () => {
  await expect(
    createAttachment(new File(["<script>bad</script>"], "fake.pdf")),
  ).rejects.toThrow();
  await expect(
    createAttachment(new File(["%PDF-broken"], "broken.pdf")),
  ).rejects.toThrow();
});
it("only generates enclosure text for real selected references and uses the correct memo structure", () => {
  const assets = {
      regular: "",
      bold: "",
      garuda: "",
      routingStamp: "",
      copyMark: "",
    },
    empty = { ...newDraft(), attachments: "LEGACY_TEXT" };
  expect(documentHtml(empty, assets)).not.toContain("LEGACY_TEXT");
  expect(documentHtml(empty, assets)).not.toContain("สิ่งที่ส่งมาด้วย");
  const a = {
    originalAvailable: false,
    id: "00000000-0000-4000-8000-000000000001",
    name: "a.pdf",
    description: "กำหนดการทดสอบ",
    showNameInDocument: true,
    pages: 2,
    bytes: 100,
    quantity: 1,
    unit: "ฉบับ" as const,
  };
  expect(documentHtml({ ...empty, attachmentFiles: [a] }, assets)).toContain(
    "สิ่งที่ส่งมาด้วย",
  );
  const memo = documentHtml(
    { ...empty, type: "internal", attachmentFiles: [a] },
    assets,
  );
  expect(memo).not.toContain("สิ่งที่ส่งมาด้วย");
  expect(memo).toContain("ตามเอกสารที่แนบมาพร้อมนี้");
});
it("hides an attachment name while retaining its count in external and internal documents", () => {
  const assets = {
    regular: "",
    bold: "",
    garuda: "",
    routingStamp: "",
    copyMark: "",
  };
  const file = {
    originalAvailable: false,
    id: "00000000-0000-4000-8000-000000000019",
    name: "private-schedule.pdf",
    description: "กำหนดการภายใน",
    pages: 2,
    bytes: 100,
    quantity: 2,
    unit: "ฉบับ" as const,
  };
  expect(
    documentSchema.parse({ ...newDraft(), attachmentFiles: [file] })
      .attachmentFiles[0].showNameInDocument,
  ).toBe(true);
  for (const type of ["external", "internal"] as const) {
    const html = documentHtml(
      {
        ...newDraft(type),
        attachmentFiles: [{ ...file, showNameInDocument: false }],
      },
      assets,
    );
    expect(html).toContain("เอกสารแนบ จำนวน 2 ฉบับ");
    expect(html).not.toContain(file.description);
    expect(html).not.toContain(file.name);
  }
});
