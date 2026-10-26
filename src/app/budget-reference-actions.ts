"use server";
/**
 * แผนที่อ่านโค้ด — src/app/budget-reference-actions.ts
 * หน้าที่: ค้นรายการมาตรฐานงบประมาณจากดัชนีเพื่อให้หน้าจอเลือกใช้
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/budget.ts
 * 2. ../components/budget-transfers.tsx
 * 3. ./budget-actions.ts
 * 4. ../lib/budget-db.ts
 * 5. ../lib/budget-document.ts
 * 6. ../lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/budget-reference-picker.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/budget-reference-index.json, ../lib/budget-references.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ../lib/budget-reference-index.json — ข้อมูล JSON ที่ผู้เรียกอ่านเป็นค่า ไม่สามารถใส่คอมเมนต์ในไฟล์ JSON โดยตรง */
import index from "@/lib/budget-reference-index.json";
/* นำเข้า ../lib/budget-references.ts — ข้อมูลและตัวช่วยอ้างเกณฑ์ราคามาตรฐาน/จำแนกงบประมาณที่เลือกประกอบคำขอ; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { ReferenceSearch, ReferenceSource } from "@/lib/budget-references";
/* searchBudgetReferences: ค้นรายการมาตรฐานงบประมาณจากดัชนีเพื่อให้หน้าจอเลือกใช้ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function searchBudgetReferences(
  query: string,
  source: string = "",
): Promise<ReferenceSearch> {
  await requireUser();
  z.string().max(150).parse(query);
  z.enum(["", "ict", "ict-2569", "equipment", "classification"]).parse(source);
  const norm = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[๐-๙]/g, (c) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)))
      .replace(/\s/g, "")
      .toLowerCase();
  const q = norm(query);
  const items = index.items
    .filter(
      (r) =>
        !r.archived &&
        (!source || r.source === source) &&
        norm(r.title + " " + r.type + " " + r.code).includes(q),
    )
    .slice(0, 25);
  const pages = q
    ? index.pages
        .filter(
          (r) => (!source || r.source === source) && norm(r.text).includes(q),
        )
        .slice(0, 25)
        .map((r) => ({ ...r, text: r.text.slice(0, 240) }))
    : [];
  return {
    items: items as ReferenceSearch["items"],
    pages: pages as { source: ReferenceSource; page: number; text: string }[],
  };
}
