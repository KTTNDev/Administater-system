"use server";
/**
 * แผนที่อ่านโค้ด — src/app/legal-actions.ts
 * หน้าที่: CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/law-library.tsx
 * 2. ./legal-actions.ts ← คุณอยู่ที่นี่
 * 3. ../lib/legal.ts
 * 4. ../lib/db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./storage-actions.ts, ../components/document-tools.tsx, ../components/law-library.tsx, ../components/writing-assistants.tsx, ../../tests/legal-library.test.ts
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/db.ts, ../lib/storage.ts, ../lib/legal.ts, ../lib/drive.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID, createHash } from "node:crypto";
/* นำเข้า next/cache — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { revalidatePath } from "next/cache";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "@/lib/db";
/* นำเข้า ../lib/storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { mirrorLegal } from "@/lib/storage";
/* นำเข้า ../lib/legal.ts — ชนิดและข้อมูลกฎหมายอ้างอิงเริ่มต้นสำหรับเครื่องมือช่วยร่าง */
import { legalSchema } from "@/lib/legal";
/* นำเข้า ../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { uploadLibraryPdf } from "@/lib/drive";
/* เตรียมตารางของโมดูลนี้บน connection กลางจาก db.ts แล้วคืนตัวเชื่อมพร้อมใช้ */
function connection() {
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS legal_library(id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL)",
  );
  return c;
}
/* listLegalReferences: CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function listLegalReferences() {
  await requireUser();
  return connection()
    .prepare(
      "SELECT id,data,file_name,updated_at FROM legal_library ORDER BY updated_at DESC",
    )
    .all()
    .map((r) => ({
      id: String(r.id),
      ...legalSchema.parse(JSON.parse(String(r.data))),
      fileName: r.file_name ? String(r.file_name) : null,
      updatedAt: String(r.updated_at),
    }));
}
/* saveLegalReference: CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function saveLegalReference(form: FormData) {
  await requireUser();
  const id = form.get("id")
      ? z.string().uuid().parse(form.get("id"))
      : randomUUID(),
    file = form.get("file");
  let bytes: Buffer | null = null,
    name: string | null = null;
  if (file instanceof File && file.size) {
    if (file.size > 10 * 1024 * 1024) throw new Error("PDF ต้องไม่เกิน 10 MB");
    bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("รองรับไฟล์ PDF เท่านั้น");
    name = file.name.slice(0, 200);
  }
  const c = connection();
  c.transaction(() => {
    const old = c
      .prepare("SELECT data,updated_at FROM legal_library WHERE id=?")
      .get(id);
    if (form.get("id") && !old)
      throw new Error("ไม่พบรายการเดิม กรุณาโหลดคลังใหม่");
    if (
      old &&
      form.get("updatedAt") &&
      String(old.updated_at) !== form.get("updatedAt")
    )
      throw new Error("รายการเปลี่ยนแล้ว กรุณาปิดฟอร์มและโหลดใหม่");
    const previous = old ? JSON.parse(String(old.data)) : {};
    const fields = Object.fromEntries(
      [
        "title",
        "url",
        "section",
        "notes",
        "category",
        "tags",
        "year",
        "status",
        "highlight",
        "page",
      ]
        .filter((k) => form.has(k))
        .map((k) => [k, String(form.get(k) || "")]),
    );
    const data = legalSchema.parse({ ...previous, ...fields });
    if (
      bytes ||
      ["title", "category", "year"].some(
        (k) => previous[k] !== data[k as keyof typeof data],
      )
    ) {
      data.driveFileId = "";
      data.driveHash = "";
    }
    const at = new Date(
      Math.max(Date.now(), old ? Date.parse(String(old.updated_at)) + 1 : 0),
    ).toISOString();
    c.prepare(
      "INSERT INTO legal_library(id,data,file,file_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,file=COALESCE(excluded.file,legal_library.file),file_name=COALESCE(excluded.file_name,legal_library.file_name),updated_at=excluded.updated_at",
    ).run(id, JSON.stringify(data), bytes, name, at);
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(id, old ? "legal_update" : "legal_create", 1, at);
  })();
  try {
    mirrorLegal(id);
  } catch {
    throw new Error(
      "บันทึกในฐานข้อมูลแล้ว แต่เขียนสำเนา PDF ไม่สำเร็จ กรุณาตรวจพาธในตั้งค่าและกดส่งออกในเครื่อง",
    );
  }
  revalidatePath("/");
  return id;
}
/* uploadLegalReference: CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function uploadLegalReference(id: string) {
  await requireUser();
  const key = z.string().uuid().parse(id),
    c = connection(),
    row = c.prepare("SELECT * FROM legal_library WHERE id=?").get(key);
  if (!row?.file) throw new Error("กรุณาแนบ PDF และบันทึกเข้าคลังก่อน");
  const data = legalSchema.parse(JSON.parse(String(row.data))),
    bytes = Buffer.from(row.file as Uint8Array),
    hash = createHash("sha256")
      .update(bytes)
      .update(JSON.stringify([data.title, data.category, data.year]))
      .digest("hex");
  const fileId = await uploadLibraryPdf({
    id: key,
    hash,
    title: data.title,
    category: data.category,
    year: data.year,
    bytes,
  });
  c.transaction(() => {
    const latest = c
      .prepare("SELECT data,updated_at FROM legal_library WHERE id=?")
      .get(key);
    if (latest && String(latest.updated_at) === String(row.updated_at)) {
      c.prepare("UPDATE legal_library SET data=? WHERE id=?").run(
        JSON.stringify({
          ...JSON.parse(String(latest.data)),
          driveFileId: fileId,
          driveHash: hash,
        }),
        key,
      );
    } else
      throw new Error(
        "อัปโหลดฉบับก่อนแก้ไขแล้ว แต่รายการเปลี่ยนระหว่างอัปโหลด กรุณาโหลดคลังและอัปโหลดฉบับล่าสุดอีกครั้ง",
      );
  })();
  revalidatePath("/");
  return fileId;
}
/* deleteLegalReference: CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function deleteLegalReference(id: string) {
  await requireUser();
  const key = z.string().uuid().parse(id),
    c = connection();
  c.transaction(() => {
    const used = c
      .prepare("SELECT data FROM documents")
      .all()
      .some((r) =>
        (JSON.parse(String(r.data)).legalReferenceIds || []).includes(key),
      );
    if (used)
      throw new Error(
        "รายการนี้ถูกอ้างอิงในร่างหนังสือ กรุณาถอดการเชื่อมโยงก่อนลบ",
      );
    c.prepare("DELETE FROM legal_library WHERE id=?").run(key);
  })();
  revalidatePath("/");
}
