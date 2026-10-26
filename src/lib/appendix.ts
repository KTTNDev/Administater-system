/**
 * แผนที่อ่านโค้ด — src/lib/appendix.ts
 * หน้าที่: จัดเก็บภาพภาคผนวก ตรวจชนิด ขนาด และความตรงกันของข้อมูลภาพกับไฟล์จริง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./document.ts
 * 2. ../components/appendix-editor.tsx
 * 3. ../app/appendix-actions.ts
 * 4. ./appendix.ts ← คุณอยู่ที่นี่
 * 5. ./render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/actions.ts, ../app/appendix-actions.ts, ./pdf.ts, ../../tests/appendix.test.ts
 * อ่านต่อจาก import: ./db.ts, ./storage.ts, ./document.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า ./db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "./db";
/* นำเข้า ./storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { storageConfig } from "./storage";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "./document";

/* ชนิด AppendixRow: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type AppendixRow = {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  file: Uint8Array;
};
/* เตรียมตารางภาพภาคผนวก; ภาพเก็บเป็น BLOB และ metadata ใช้ตรวจความตรงกัน */
export function appendixImageTable() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS document_appendix_images(id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL)`,
  );
}
/* อ่านส่วนหัว PNG/JPEG เพื่อหาความกว้างสูง ไม่เชื่อชื่อไฟล์หรือ MIME เพียงอย่างเดียว */
function dimensions(bytes: Buffer, mime: string) {
  if (
    mime === "image/png" &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.length >= 24
  )
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      i += 2;
      if (
        marker === 0xd8 ||
        marker === 0xd9 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      )
        continue;
      if (i + 2 > bytes.length) break;
      const size = bytes.readUInt16BE(i);
      if (size < 2 || i + size > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        size >= 7
      )
        return {
          height: bytes.readUInt16BE(i + 3),
          width: bytes.readUInt16BE(i + 5),
        };
      i += size;
    }
  }
  throw new Error("ไฟล์ภาพไม่ถูกต้อง รองรับ PNG หรือ JPEG เท่านั้น");
}
/* ตรวจภาพ เขียนสำเนาลงโฟลเดอร์ และเก็บ BLOB ในฐานข้อมูล คืน metadata ให้ UI */
export async function createAppendixImage(file: File) {
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("รูปภาพต้องมีขนาดไม่เกิน 10 MB ต่อรูป");
  const mime = file.type as "image/png" | "image/jpeg";
  if (!["image/png", "image/jpeg"].includes(mime))
    throw new Error("รองรับเฉพาะรูปภาพ PNG และ JPEG");
  const bytes = Buffer.from(await file.arrayBuffer()),
    size = dimensions(bytes, mime);
  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > 30000 ||
    size.height > 30000
  )
    throw new Error("ขนาดภาพไม่ถูกต้องหรือใหญ่เกินกำหนด");
  const id = randomUUID(),
    name =
      file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 240) ||
      `ภาพแนบท้าย${mime === "image/png" ? ".png" : ".jpg"}`,
    ext = mime === "image/png" ? ".png" : ".jpg";
  const folder = path.join(storageConfig().localFolder, "เอกสารแนบท้าย");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, id + ext), bytes, { flag: "wx" });
  appendixImageTable();
  db()
    .prepare(
      "INSERT INTO document_appendix_images(id,name,mime,width,height,file,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      id,
      name,
      mime,
      size.width,
      size.height,
      bytes,
      new Date().toISOString(),
    );
  return {
    id,
    name,
    mime,
    bytes: bytes.length,
    ...size,
    caption: "",
    widthMm: size.width / size.height >= 1 ? 165 : 80,
    source: `data:${mime};base64,${bytes.toString("base64")}`,
  };
}
/* อ่านภาพตาม id; ไม่พบต้องให้ผู้ใช้แนบใหม่แทนแสดงรูปที่ไม่ตรงกับร่าง */
export function readAppendixImage(id: string): AppendixRow {
  appendixImageTable();
  const row = db()
    .prepare("SELECT * FROM document_appendix_images WHERE id=?")
    .get(id);
  if (!row) throw new Error("ไม่พบรูปภาพแนบท้าย กรุณาแนบรูปใหม่");
  return {
    id: String(row.id),
    name: String(row.name),
    mime: String(row.mime),
    width: Number(row.width),
    height: Number(row.height),
    file: Buffer.from(row.file as Uint8Array),
  };
}
/* แปลงภาพที่ตรวจ metadata แล้วเป็น Record<id,dataURL> ให้ตัวแสดงเอกสาร */
export function appendixSources(draft: Draft) {
  const result: Record<string, string> = {};
  for (const item of draft.appendixImages) {
    const row = readAppendixImage(item.id);
    if (
      row.mime !== item.mime ||
      row.width !== item.width ||
      row.height !== item.height ||
      row.file.byteLength !== item.bytes
    )
      throw new Error("ข้อมูลรูปภาพแนบท้ายไม่ตรงกับไฟล์ที่จัดเก็บ");
    result[item.id] =
      `data:${row.mime};base64,${Buffer.from(row.file).toString("base64")}`;
  }
  return result;
}
/* ตรวจ id ซ้ำ ขนาด และ metadata ของภาพทุกภาพก่อนบันทึก/ส่งออก */
export function validateAppendixImages(draft: Draft) {
  let total = 0;
  const seen = new Set<string>();
  for (const item of draft.appendixImages) {
    if (seen.has(item.id)) throw new Error("มีรูปภาพแนบท้ายซ้ำ");
    seen.add(item.id);
    const row = readAppendixImage(item.id);
    if (
      row.mime !== item.mime ||
      row.width !== item.width ||
      row.height !== item.height ||
      row.file.byteLength !== item.bytes
    )
      throw new Error("ข้อมูลรูปภาพแนบท้ายไม่ตรงกับไฟล์ที่จัดเก็บ");
    total += item.bytes;
  }
  if (total > 50 * 1024 * 1024) throw new Error("รูปภาพแนบท้ายรวมเกิน 50 MB");
}
