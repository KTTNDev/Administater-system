/**
 * แผนที่อ่านโค้ด — tests/appendix.test.ts
 * หน้าที่: กรณีทดสอบ appendix; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/document.ts
 * 2. ../src/components/appendix-editor.tsx
 * 3. ../src/app/appendix-actions.ts
 * 4. ../src/lib/appendix.ts
 * 5. ../src/lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/appendix.ts, ../src/lib/document.ts, ../src/lib/storage.ts
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
import { db, setSetting, writeDraft, readDraft } from "../src/lib/db";
/* นำเข้า ../src/lib/appendix.ts — จัดเก็บภาพภาคผนวก ตรวจชนิด ขนาด และความตรงกันของข้อมูลภาพกับไฟล์จริง */
import {
  appendixSources,
  createAppendixImage,
  readAppendixImage,
  validateAppendixImages,
} from "../src/lib/appendix";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { exportWorkspace } from "../src/lib/storage";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-appendix-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
  setSetting("storage:local", path.join(dir, "files"));
});
afterAll(() => db().close());
it("stores image bytes and dimensions, persists draft metadata, and includes images in backups", async () => {
  const original = fs.readFileSync("public/assets/garuda.png"),
    stored = await createAppendixImage(
      new File([new Uint8Array(original)], "evidence.png", {
        type: "image/png",
      }),
    );
  const { source, ...image } = stored,
    draft = {
      ...newDraft("external"),
      appendixTitle: "ภาพหลักฐาน",
      appendixImages: [image],
    };
  validateAppendixImages(draft);
  expect(readAppendixImage(image.id).file).toEqual(original);
  expect(appendixSources(draft)[image.id]).toBe(source);
  const saved = writeDraft(draft);
  expect(readDraft(saved.id).appendixImages[0]).toMatchObject({
    id: image.id,
    width: image.width,
    height: image.height,
    caption: "",
  });
  const backup = exportWorkspace();
  expect(fs.readFileSync(path.join(backup.folder, image.id + ".png"))).toEqual(
    original,
  );
}, 30000);
it("rejects fake image data and unsupported image types", async () => {
  await expect(
    createAppendixImage(
      new File(["not an image"], "bad.png", { type: "image/png" }),
    ),
  ).rejects.toThrow();
  await expect(
    createAppendixImage(
      new File(["not an image"], "bad.gif", { type: "image/gif" }),
    ),
  ).rejects.toThrow();
});
