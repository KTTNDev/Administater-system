/**
 * แผนที่อ่านโค้ด — src/lib/legal.ts
 * หน้าที่: ชนิดและข้อมูลกฎหมายอ้างอิงเริ่มต้นสำหรับเครื่องมือช่วยร่าง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/law-library.tsx
 * 2. ../app/legal-actions.ts
 * 3. ./legal.ts ← คุณอยู่ที่นี่
 * 4. ./db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/legal-actions.ts, ../components/law-library.tsx
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
export const lawCategories = [
  "งานสารบรรณ",
  "การบริหารท้องถิ่น",
  "บุคลากร",
  "การเงินและงบประมาณ",
  "พัสดุและจัดซื้อจัดจ้าง",
  "ข้อมูลข่าวสารและดิจิทัล",
  "บริการสาธารณะ",
  "กฎหมายทั่วไป",
  "อื่น ๆ",
];
export const legalSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อเอกสาร").max(300),
  url: z.union([
    z.literal(""),
    z
      .string()
      .url()
      .refine((v) => /^https?:\/\//i.test(v), "ใช้ลิงก์ http หรือ https"),
  ]),
  section: z.string().max(300),
  notes: z.string().max(10000),
  category: z.string().trim().min(1).max(100).default("อื่น ๆ"),
  tags: z.string().max(1000).default(""),
  year: z
    .string()
    .regex(/^(\d{4})?$/, "ระบุปี พ.ศ. 4 หลัก หรือเว้นว่าง")
    .default(""),
  status: z
    .enum(["unchecked", "current", "amended", "repealed"])
    .default("unchecked"),
  highlight: z.string().max(5000).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  driveFileId: z.string().default(""),
  driveHash: z.string().default(""),
});
/* ชนิด LegalRecord: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type LegalRecord = z.infer<typeof legalSchema> & {
  id: string;
  fileName: string | null;
  updatedAt: string;
};
export const lawStatuses = {
  unchecked: "ยังไม่ตรวจสอบสถานะ",
  current: "ตรวจแล้ว: ใช้บังคับ",
  amended: "มีฉบับแก้ไข",
  repealed: "ยกเลิกแล้ว",
};
