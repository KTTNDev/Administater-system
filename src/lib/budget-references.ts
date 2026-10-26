/**
 * แผนที่อ่านโค้ด — src/lib/budget-references.ts
 * หน้าที่: ข้อมูลและตัวช่วยอ้างเกณฑ์ราคามาตรฐาน/จำแนกงบประมาณที่เลือกประกอบคำขอ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./budget.ts
 * 2. ../components/budget-transfers.tsx
 * 3. ../app/budget-actions.ts
 * 4. ./budget-db.ts
 * 5. ./budget-document.ts
 * 6. ./render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/api/budget-references/[id]/route.ts, ../app/budget-reference-actions.ts, ../components/budget-reference-picker.tsx, ../components/budget-transfers.tsx, ./budget-document.ts, ./budget.ts, ../../tests/budget-references.test.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
export const referenceSources = {
  ict: {
    title:
      "เกณฑ์ราคากลางและคุณลักษณะพื้นฐานการจัดหาอุปกรณ์และระบบคอมพิวเตอร์ ฉบับเดือนธันวาคม 2568",
    short: "คอมพิวเตอร์ · ธ.ค. 2568",
    pages: 33,
  },
  "ict-2569": {
    title:
      "เกณฑ์ราคากลางและคุณลักษณะพื้นฐานการจัดหาอุปกรณ์และระบบคอมพิวเตอร์ ฉบับปรับปรุง รายการที่ 1–11 เดือนพฤษภาคม 2569",
    short: "คอมพิวเตอร์ · พ.ค. 2569 (1–11)",
    pages: 9,
  },
  equipment: {
    title: "บัญชีราคามาตรฐานครุภัณฑ์ สำนักงบประมาณ ฉบับเดือนธันวาคม 2568",
    short: "ครุภัณฑ์ · ธ.ค. 2568",
    pages: 118,
  },
  classification: {
    title:
      "หนังสือกรมส่งเสริมการปกครองท้องถิ่น ที่ มท 0808.2/ว 1095 ลงวันที่ 28 พฤษภาคม 2564 เรื่อง รูปแบบและการจำแนกประเภทรายรับ–รายจ่าย งบประมาณรายจ่ายประจำปีขององค์กรปกครองส่วนท้องถิ่น",
    short: "จำแนกประเภท · ว 1095",
    pages: 107,
  },
} as const;
/* ชนิด ReferenceSource: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type ReferenceSource = keyof typeof referenceSources;
export const circulars = {
  "1095": referenceSources.classification.title,
  "1989":
    "หนังสือกระทรวงมหาดไทย ที่ มท 0808.2/ว 1989 ลงวันที่ 22 มิถุนายน 2552 เรื่อง การตั้งงบประมาณเพื่อการจัดซื้อครุภัณฑ์และรถยนต์ขององค์กรปกครองส่วนท้องถิ่น",
  "7509":
    "หนังสือกระทรวงมหาดไทย ที่ มท 0810.3/ว 7509 ลงวันที่ 7 ตุลาคม 2565 เรื่อง แนวทางการดำเนินงานตามแผนพัฒนาท้องถิ่นขององค์กรปกครองส่วนท้องถิ่น",
} as const;
export const referenceFields = {
  pricingBasis: z
    .enum(["unverified", "standard", "local"])
    .default("unverified"),
  sourceId: z.enum(["", "ict", "ict-2569", "equipment"]).default(""),
  sourcePage: z.number().int().min(1).max(118).default(1),
  sourceItem: z.string().max(500).default(""),
  catalogId: z.string().max(100).default(""),
  classificationPage: z.number().int().min(0).max(107).default(0),
  pricingReason: z.string().max(2000).default(""),
  pricingEvidence: z.string().max(2000).default(""),
  citedCirculars: z
    .array(z.enum(["1095", "1989", "7509"]))
    .max(3)
    .default([]),
  referenceChecked: z.boolean().default(false),
};
export const referenceSchema = z.object(referenceFields);
/* ชนิด BudgetReference: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type BudgetReference = z.infer<typeof referenceSchema>;
export const emptyReference = () => referenceSchema.parse({});
/* referenceIssues: ข้อมูลและตัวช่วยอ้างเกณฑ์ราคามาตรฐาน/จำแนกงบประมาณที่เลือกประกอบคำขอ */
export function referenceIssues(r: BudgetReference) {
  const errors: string[] = [];
  if (r.pricingBasis === "unverified")
    errors.push("เลือกแหล่งอ้างอิงราคาของรายการ");
  if (!r.referenceChecked)
    errors.push("ตรวจและยืนยันการจำแนกประเภท คุณลักษณะ และแหล่งอ้างอิง");
  if (
    r.pricingBasis === "standard" &&
    (!r.sourceId ||
      !r.sourceItem.trim() ||
      r.sourcePage > referenceSources[r.sourceId].pages)
  )
    errors.push("ระบุบัญชี รายการ และหน้าอ้างอิงให้ครบ");
  if (
    r.pricingBasis === "standard" &&
    r.sourceId === "ict" &&
    /^\s*(?:[1-9]|10|11)(?:\D|$)/.test(r.sourceItem)
  )
    errors.push(
      "รายการคอมพิวเตอร์ 1–11 มีฉบับปรับปรุง พ.ค. 2569 กรุณาเลือกฉบับใหม่",
    );
  if (
    r.pricingBasis === "local" &&
    (!r.pricingReason.trim() || !r.pricingEvidence.trim())
  )
    errors.push("ระบุเหตุผลนอกบัญชีและหลักฐานสืบราคาที่ใช้อ้างอิง");
  return errors;
}
/* referenceText: ข้อมูลและตัวช่วยอ้างเกณฑ์ราคามาตรฐาน/จำแนกงบประมาณที่เลือกประกอบคำขอ */
export function referenceText(r: BudgetReference): string[] {
  const lines: string[] = [];
  if (r.pricingBasis === "standard" && r.sourceId)
    lines.push(
      `กำหนดราคาและคุณลักษณะโดยอ้างอิง${referenceSources[r.sourceId].title} รายการ ${r.sourceItem} หน้า PDF ${r.sourcePage}`,
    );
  if (r.pricingBasis === "local") {
    lines.push(
      `ตั้งงบประมาณตามราคาท้องถิ่น เนื่องจาก ${r.pricingReason || "[ระบุเหตุผลที่ไม่สามารถใช้รายการมาตรฐาน]"}`,
    );
    lines.push(
      `หลักฐานประกอบการสืบราคา: ${r.pricingEvidence || "[ระบุแหล่งราคาและวันที่]"}`,
    );
  }
  for (const code of [...new Set(r.citedCirculars)])
    lines.push(
      `เป็นไปตาม${circulars[code]}${code === "1095" && r.classificationPage ? ` (หน้า PDF ${r.classificationPage})` : ""}`,
    );
  return lines;
}
/* ชนิด CatalogItem: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type CatalogItem = {
  id: string;
  source: ReferenceSource;
  page: number;
  code: string;
  title: string;
  price: string;
  specification: string;
  specPage?: number;
  type: string;
  classificationPage: number;
  archived: boolean;
};
/* ชนิด ReferenceSearch: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type ReferenceSearch = {
  items: CatalogItem[];
  pages: { source: ReferenceSource; page: number; text: string }[];
};
