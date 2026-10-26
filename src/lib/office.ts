/**
 * แผนที่อ่านโค้ด — src/lib/office.ts
 * หน้าที่: กฎข้อมูลทะเบียนงานธุรการ ชนิดงาน สถานะ และข้อมูลหนังสือที่เชื่อมโยง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./office.ts ← คุณอยู่ที่นี่
 * 2. ../components/office-workspace.tsx
 * 3. ../app/office-actions.ts
 * 4. ./office-db.ts
 * 5. ./db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/office-workspace.tsx, ../components/system-center.tsx, ../components/work-calendar.tsx, ../components/workspace.tsx, ./office-db.ts, ../../tests/office.test.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
export const officeKinds = {
  incoming: "ทะเบียนหนังสือรับ",
  outgoing: "ทะเบียนหนังสือส่ง",
  task: "งานและกำหนดส่ง",
  meeting: "การประชุม",
  contact: "ทำเนียบหน่วยงาน",
  supplies: "วัสดุสำนักงาน",
  archive: "ดัชนีแฟ้มเอกสาร",
} as const;
/* ชนิด OfficeKind: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type OfficeKind = keyof typeof officeKinds;
const short = z.string().trim().max(500).default("");
const date = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v);
        return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
      }),
  ])
  .default("");
export const officeSchema = z.object({
  kind: z.enum([
    "incoming",
    "outgoing",
    "task",
    "meeting",
    "contact",
    "supplies",
    "archive",
  ]),
  title: z.string().trim().min(1, "กรุณาระบุชื่อเรื่อง").max(300),
  number: short,
  party: short,
  owner: short,
  date,
  due: date,
  status: z.enum(["new", "working", "waiting", "done"]).default("new"),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  notes: z.string().max(20000).default(""),
  documentId: z.union([z.literal(""), z.string().uuid()]).default(""),
  url: z
    .union([
      z.literal(""),
      z
        .string()
        .url()
        .refine(
          (v) => /^https?:\/\//.test(v),
          "ใช้ลิงก์ http หรือ https เท่านั้น",
        ),
    ])
    .default(""),
  quantity: z.number().min(0).max(100000000).default(0),
  minimum: z.number().min(0).max(100000000).default(0),
  unit: short,
});
/* ชนิด OfficeInput: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type OfficeInput = z.infer<typeof officeSchema>;
/* ชนิด OfficeItem: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type OfficeItem = OfficeInput & {
  id: string;
  version: number;
  updatedAt: string;
};
export const officeStatuses = {
  new: "รับเรื่อง / ยังไม่เริ่ม",
  working: "กำลังดำเนินการ",
  waiting: "รอผล / รอประสาน",
  done: "เสร็จสิ้น",
};
export const routineTasks = [
  "ตรวจหนังสือเข้าและช่องทางรับเรื่อง",
  "ลงทะเบียนและเสนอผู้บังคับบัญชา",
  "ติดตามหนังสือที่ใกล้ครบกำหนด",
  "ตรวจความครบถ้วนก่อนส่งหนังสือ",
  "จัดแฟ้มและตรวจไฟล์สำรอง",
];
