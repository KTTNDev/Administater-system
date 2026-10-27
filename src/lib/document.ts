/**
 * แผนที่อ่านโค้ด — src/lib/document.ts
 * หน้าที่: สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ../components/workspace.tsx
 * 3. ./document.ts ← คุณอยู่ที่นี่
 * 4. ../app/actions.ts
 * 5. ./db.ts
 * 6. ./render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ./pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/actions.ts, ../components/appendix-editor.tsx, ../components/attachment-editor.tsx, ../components/budget-transfers.tsx, ../components/document-dashboard.tsx, ../components/document-tools.tsx, ../components/meeting-bookings.tsx, ../components/minutes-details.tsx (และจุดอื่นที่ค้นชื่อ export ได้ใน IDE)
 * อ่านต่อจาก import: ./minutes-presets.ts, ./templates.ts
 *
 * แนวทางแก้: เพิ่มช่องพร้อม default เพื่อเปิดร่างเก่าได้ แล้วตามไป UI, bodySections/render-document และ tests
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ./minutes-presets.ts — แม่แบบประชุมทั่วไป / TOR งานซื้อ / TOR งานจ้าง สร้างเฉพาะโครง ไม่สมมติราคา สเปก หรือมติให้ผู้ใช้ */
import { torDetailSections } from "./minutes-presets";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ./templates.ts — ทะเบียนประเภทหนังสือ หมวด ชื่อ คำแนะนำ และข้อมูลหน่วยงานตัวอย่าง */
import { templates, type DocumentType } from "./templates";
/* กฎ string ที่ใช้ซ้ำหลายช่อง: จำกัด 2,000 ตัวอักษรและให้ค่าเริ่มต้นว่าง */
const text = z.string().max(2000).default("");
/* ตรวจ/แปลง documentSchema จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
export const documentSchema = z.object({
  /* รหัสชนิดเอกสารต้องอยู่ใน templates.ts; เพิ่มแบบใหม่ให้เพิ่มทะเบียน ฟอร์ม และ case ใน render-document.ts พร้อมกัน */
  type: z.enum(templates.map((t) => t.id) as [DocumentType, ...DocumentType[]]),
  /* ชื่อเรื่องตัดช่องว่างหัวท้ายและต้องไม่ว่าง; max(300) เป็นขีดจำกัดจริงฝั่ง server ไม่ใช่แค่ maxLength ใน input */
  subject: z.string().trim().min(1, "กรุณาระบุเรื่อง").max(300),
  /* เลขที่หนังสือจากทะเบียนของหน่วยงาน ช่องนี้ไม่ใช่ระบบจองเลข */
  number: text,
  /* เก็บ ISO ค.ศ. เพื่อคำนวณและเรียงได้; ตอนแสดงเรียก thaiDate ไม่ควรเก็บวันที่ พ.ศ. ลงช่องนี้ */
  date: z
    .string()
    .refine((v) => {
      if (v === "") return true; // Keep older in-progress drafts readable; review still requires a valid date.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const d = new Date(v + "T00:00:00Z");
      return (
        !isNaN(d.getTime()) &&
        d.toISOString().slice(0, 10) === v &&
        +v.slice(0, 4) >= 1900 &&
        +v.slice(0, 4) < 2200
      );
    }, "วันที่ไม่ถูกต้อง (บันทึกปี ค.ศ. และแสดงผลเป็น พ.ศ.)")
    .default(""),
  /* ส่วนราชการเจ้าของหนังสือ; ค่าเริ่มร่างมาจาก settings ใน Workspace */
  organization: text,
  /* หน่วยงานเจ้าของเรื่อง ใช้ประกอบหัว/ส่วนติดต่อของหนังสือ */
  department: text,
  /* ที่อยู่ส่วนราชการสำหรับหนังสือภายนอก */
  address: text,
  /* ข้อความเบอร์โทร ไม่ใช่ number เพราะต้องเก็บเลขศูนย์นำหน้า */
  phone: text,
  /* อีเมลติดต่อที่ renderer นำไปแสดงในส่วนท้าย */
  email: text,
  /* คำขึ้นต้น เช่น เรียน; ค่า default รองรับร่างเก่าที่ไม่มีช่องนี้ */
  salutation: z.string().max(80).default("เรียน"),
  /* ชื่อหรือตำแหน่งผู้รับหนังสือ; reviewIssues ตรวจเมื่อแบบนั้นต้องมีผู้รับ */
  recipient: text,
  /* ข้อความอ้างถึงหนังสือเดิมในส่วนหัว */
  reference: text,
  /* ข้อความรายการแนบของร่างเก่า; ไฟล์ที่รวม PDF จริงใช้ attachmentFiles */
  attachments: text,
  /* ข้อความสำเนาส่ง ไม่ใช่ตราสำเนาคู่ฉบับ; ตราเลือกด้วย copyMark */
  copies: text,
  /* เก็บ metadata/id ของไฟล์ ไม่เก็บ bytes ของ PDF ใน Draft; bytes จริงอยู่ตาราง document_attachments ใน attachments.ts */
  attachmentFiles: z
    .array(
      z.object({
        originalAvailable: z.boolean().default(false),
        id: z.string().uuid(),
        name: z.string().min(1).max(240),
        description: z.string().trim().min(1).max(300),
        showNameInDocument: z.boolean().default(true),
        pages: z.number().int().positive().max(200),
        bytes: z
          .number()
          .int()
          .positive()
          .max(15 * 1024 * 1024),
        quantity: z.number().int().min(1).max(999).default(1),
        unit: z.enum(["ฉบับ", "ชุด", "แผ่น"]).default("ฉบับ"),
      }),
    )
    .max(10)
    .default([]),
  /* ข้อความที่หนังสือภายในใช้เชื่อมเนื้อหากับรายการไฟล์แนบ */
  attachmentPhrase: z
    .enum([
      "ตามเอกสารที่แนบมาพร้อมนี้",
      "รายละเอียดตามเอกสารแนบ",
      "พร้อมนี้ได้แนบเอกสารประกอบการพิจารณา",
    ])
    .default("ตามเอกสารที่แนบมาพร้อมนี้"),
  /* ชื่อหัวหน้าภาคผนวกภาพ แก้ผ่าน AppendixEditor */
  appendixTitle: z.string().trim().max(200).default(""),
  /* ตัวเลือกอัตโนมัติ/เรียงบนล่าง/สองคอลัมน์; วิธีจัดภาพอยู่ render-document.ts */
  appendixLayout: z.enum(["auto", "stack", "columns"]).default("auto"),
  /* array ข้อมูลรูปภาคผนวก; widthMm เป็นขนาดพิมพ์ ส่วน width/height เป็นพิกเซลต้นฉบับ */
  appendixImages: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(240),
        mime: z.enum(["image/png", "image/jpeg"]),
        bytes: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024),
        width: z.number().int().positive().max(30000),
        height: z.number().int().positive().max(30000),
        caption: z.string().max(500).default(""),
        widthMm: z.number().min(30).max(180).default(150),
      }),
    )
    .max(20)
    .default([]),
  /* ข้อความอิสระของร่าง; โหมดวาระ/หัวข้อเก็บข้อมูลของตัวเองและเลือกแสดงผ่าน bodySections */
  body: z.string().max(40000).default(""),
  /* คำลงท้ายของหนังสือภายนอก ไม่ใช่ชื่อผู้ลงนาม */
  closing: z.string().max(200).default("ขอแสดงความนับถือ"),
  /* เลือกรูปแบบปกติหรือรูปแบบอ้างอิงงบ; ดู budget-document.ts ก่อนเพิ่มตัวเลือก */
  layout: z.enum(["standard", "budget-reference"]).default("standard"),
  /* ค่าขอบบนหน้าแรกเป็นตัวเลือกที่รู้จัก; หน่วยแปลงเป็น mm ใน renderer */
  firstPageTop: z.enum(["15", "25"]).default("15"),
  /* เพิ่มตราครุฑให้บันทึกข้อความชนิดที่เลือกได้ */
  memoEmblem: z.boolean().default(false),
  /* ข้อความผู้รับคำสั่งสำหรับหนังสือคำสั่ง */
  orderReceivedBy: z.string().max(200).default(""),
  /* เปิดพื้นที่รูปถ่ายของหนังสือรับรอง; ไม่มีผลกับการแนบภาพภาคผนวก */
  certificatePhotoArea: z.boolean().default(false),
  /* ชื่อผู้ได้รับการรับรองใต้พื้นที่รูปถ่าย */
  certificateRecipient: text,
  /* เลือกข้อมูลอิสระหรือวาระที่ใช้พิมพ์; การสลับโหมดไม่ควรลบข้อมูลอีกโหมด */
  minutesMode: z.enum(["free", "agenda"]).default("free"),
  /* จำแม่แบบที่เลือก ไม่ใช่ตัวล็อกให้หัวข้อแก้ไม่ได้ */
  minutesPreset: z
    .enum(["general", "tor-purchase", "tor-service"])
    .default("general"),
  /* หัวรายงานที่ปรับเอง; ว่างจะใช้หัวรายงานแบบเดิมใน renderer */
  minutesTitle: z.string().max(300).default(""),
  /* สลับรายชื่อข้อความเดิมกับตารางกรรมการ; reviewIssues ต้องตรวจให้ตรงโหมด */
  minutesAttendanceMode: z.enum(["text", "table"]).default("text"),
  /* สมาชิกตารางรายชื่อ: name/position/role/status/note; การเพิ่มช่องต้องแก้ MinutesMembersEditor และตาราง attendance ใน renderer */
  meetingMembers: z
    .array(
      z.object({
        name: z.string().max(300),
        position: z.string().max(500),
        role: z.string().max(200),
        status: z.enum(["present", "absent", "participant"]),
        note: z.string().max(1000),
      }),
    )
    .max(60)
    .default([]),
  /* ตำแหน่งราชการของผู้จด แยกจากบทบาทผู้จดเพื่อแก้รักษาการได้ */
  recorderPosition: z.string().max(500).default(""),
  /* บทบาทที่พิมพ์ใต้ชื่อผู้จด เช่น กรรมการและผู้จดรายงาน */
  recorderRole: z.string().max(200).default("ผู้จดรายงานการประชุม"),
  /* ผู้ลงนามเพิ่มเติมจากผู้จด; การพิมพ์ชื่อไม่ใช่ลายมือชื่อดิจิทัล */
  meetingSigners: z
    .array(
      z.object({
        name: z.string().max(300),
        position: z.string().max(500),
        role: z.string().max(200),
      }),
    )
    .max(20)
    .default([]),
  /* object ซ้อน: ข้อมูลคำสั่ง/งบ/หัวข้อ TOR; ตอนแก้ต้อง spread ค่าเดิมทั้ง draft และ minutesTor เพื่อไม่ลบช่องอื่น */
  minutesTor: z
    .object({
      appointmentNumber: z.string().max(200).default(""),
      appointmentDate: z
        .string()
        .max(10)
        .refine(
          (v) =>
            !v ||
            (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
              !isNaN(Date.parse(v)) &&
              new Date(v).toISOString().slice(0, 10) === v),
          "วันที่คำสั่งไม่ถูกต้อง",
        )
        .default(""),
      authority: z.string().max(500).default(""),
      budget: z.string().max(500).default(""),
      priceReference: z.string().max(2000).default(""),
      sections: z
        .array(
          z.object({ title: z.string().max(300), body: z.string().max(20000) }),
        )
        .max(30)
        .default([]),
    })
    .default({
      appointmentNumber: "",
      appointmentDate: "",
      authority: "",
      budget: "",
      priceReference: "",
      sections: [],
    }),
  /* ข้อความเปิดประชุมก่อนเริ่มวาระ เช่น ประธานกล่าวเปิดประชุม */
  minutesIntroduction: z.string().max(10000).default(""),
  /* array ของวาระ แต่ละวาระมี speeches ของตัวเอง; อย่าย้าย speeches ไปไว้ระดับ Draft ถ้าต้องการแยกตามวาระ */
  meetingAgenda: z
    .array(
      z.object({
        title: z.string().max(300).default(""),
        discussion: z.string().max(10000).default(""),
        /* flag ว่าวาระใดแทรกชุด TOR; UI ย้าย flag ให้มีวาระเดียวในครั้งที่ผู้ใช้เลือก เพื่อไม่พิมพ์ TOR ซ้ำ */
        torDetails: z.boolean().optional(),
        /* ผู้พูดเป็น array อยู่ในหนึ่งวาระ .optional() ทำให้ร่างเก่าที่ไม่มี speeches ยังอ่านได้; UI จึงใช้ speeches || [] และจำกัด 50 ให้ตรงกัน */
        speeches: z
          .array(
            z.object({
              speaker: z.string().max(300),
              role: z.string().max(200),
              text: z.string().max(10000),
            }),
          )
          .max(50)
          .optional(),
        resolution: z.string().max(5000).default(""),
        resolutionLabel: z
          .enum(["มติที่ประชุม", "ข้อยุติ", "ข้อสรุป"])
          .default("มติที่ประชุม"),
      }),
    )
    .max(50)
    .default([]),
  /* บล็อกเนื้อหาที่สร้างโดยเครื่องมือ เช่น โอนงบ; Workspace ล้างบล็อกเมื่อผู้ใช้แก้เนื้อหาปกติเพื่อไม่พิมพ์ข้อความเก่าทับใหม่ */
  contentBlocks: z
    .array(
      z.object({
        kind: z.enum([
          "paragraph",
          "heading",
          "line",
          "budget-money",
          "budget-detail",
          "budget-spec",
        ]),
        label: z.string().max(100).default(""),
        text: z.string().max(10000),
      }),
    )
    .max(500)
    .default([]),
  /* ชื่อผู้ลงนามหลักของหนังสือทั่วไป; รายงานประชุมใช้ recorder/meetingSigners */
  signer: text,
  /* ตำแหน่งผู้ลงนามหลัก อาจเป็นหลายบรรทัด */
  position: text,
  /* แปลงเลขตอนแสดงผลเท่านั้น ช่วยไม่เปลี่ยนข้อความต้นฉบับ */
  numeralStyle: z.enum(["original", "thai", "arabic"]).default("original"),
  /* ตราที่ต้องพิมพ์; สำเนาคู่ฉบับทำสองชุดใน renderer และส่วนรวมไฟล์แนบ */
  copyMark: z.enum(["none", "สำเนา", "สำเนาคู่ฉบับ"]).default("none"),
  /* เปิดตราร่าง/ผู้ตรวจตามชนิดเอกสาร */
  productionMark: z.boolean().default(false),
  /* ชื่อผู้ร่างในส่วนตรวจทานการผลิตหนังสือ */
  drafter: text,
  /* ชื่อผู้พิมพ์ในส่วนตรวจทานการผลิตหนังสือ */
  typist: text,
  /* ชื่อผู้ตรวจในส่วนตรวจทานการผลิตหนังสือ */
  checker: text,
  /* เลือกระหว่างเนื้อหาข้อความอิสระและหัวข้อบันทึกข้อความ; ไม่ใช่ minutesMode */
  bodyMode: z.enum(["free", "structured"]).default("free"),
  /* ข้อความหัวข้อเรื่องเดิมของบันทึกข้อความแบบ structured */
  background: z.string().max(10000).default(""),
  /* ข้อความข้อเท็จจริง; ลำดับที่พิมพ์ดู bodySections ด้านล่าง ไม่ใช่ลำดับช่องใน schema */
  facts: z.string().max(10000).default(""),
  /* ข้อระเบียบ/กฎหมายที่ผู้ใช้ระบุ ไม่ใช่การค้นหรือยืนยันกฎหมายอัตโนมัติ */
  legalBasis: z.string().max(10000).default(""),
  /* ข้อความข้อพิจารณาในบันทึกข้อความแบบหัวข้อ */
  consideration: z.string().max(10000).default(""),
  /* ย่อหน้าสรุปเสนอเพื่อพิจารณา แสดงโดยไม่มีหัวข้อใน bodySections */
  proposal: z.string().max(10000).default(""),
  /* เปิด/ปิดหัวข้อในเนื้อหาแบบ structured; รายงานประชุมมีเงื่อนไขหัวข้อของตัวเอง */
  sectionHeadings: z.boolean().default(true),
  /* เส้นช่วยกรอกของบันทึกข้อความ ควบคุม CSS ใน renderer */
  memoGuides: z.boolean().default(true),
  /* ผู้เสนอเพิ่มเติม ใช้สร้างบล็อกลงนามท้ายบันทึกข้อความ */
  proposers: z
    .array(z.object({ name: text, position: text }))
    .max(5)
    .default([]),
  /* ส่วนความเห็นเพิ่มเติม มีชื่อหัวข้อ ข้อความ ผู้ให้ความเห็น ตำแหน่ง และเส้นว่าง */
  opinions: z
    .array(
      z.object({
        title: text,
        comment: z.string().max(3000).default(""),
        name: text,
        position: text,
        showDate: z.boolean().default(true),
        lines: z.number().int().min(1).max(3).default(3),
      }),
    )
    .max(5)
    .default([]),
  /* เก็บรหัสกฎหมายที่เชื่อมกับร่าง ไม่คัด PDF กฎหมายทั้งหมดใส่ Draft */
  legalReferenceIds: z.array(z.string().uuid()).max(30).default([]),
  /* ชั้นความเร็วที่ renderer พิมพ์เป็นตราข้อความ */
  urgency: z.enum(["ปกติ", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"]).default("ปกติ"),
  /* ชั้นความลับ; ส่งออก/Drive ต้องตรวจเงื่อนไขประกอบ ไม่ใช่แค่เปลี่ยนสีตัวหนังสือ */
  confidentiality: z
    .enum(["ปกติ", "ลับ", "ลับมาก", "ลับที่สุด"])
    .default("ปกติ"),
  /* เลขชุดปัจจุบันของหนังสือลับ ต้องไม่เกิน secretSetTotal */
  secretSetNumber: z.number().int().min(1).max(9999).default(1),
  /* จำนวนชุดรวม ใช้ตรวจและพิมพ์ส่วนควบคุมหนังสือลับ */
  secretSetTotal: z.number().int().min(1).max(9999).default(1),
  /* เกณฑ์ปีสำหรับจัดหมวด Drive/รายการ ไม่เปลี่ยนวันในเอกสาร */
  yearMode: z.enum(["calendar", "fiscal"]).default("fiscal"),
  /* draft/reviewed เป็นสถานะตรวจทานข้อมูล ไม่ใช่การอนุมัติหนังสือตามอำนาจ */
  status: z.enum(["draft", "reviewed"]).default("draft"),
  /* ครั้งที่ประชุมเป็นข้อความ เช่น 1/2569 */
  meetingNo: text,
  /* สถานที่ประชุม แสดงในหัวรายงาน */
  location: text,
  /* รายชื่อข้อความเดิม; ถ้าใช้ตารางจะเป็นข้อความเพิ่มเติมจาก meetingMembers */
  attendees: text,
  /* ผู้ไม่มาประชุม/เหตุผลแบบข้อความ ใช้ร่วมกับสมาชิก status absent */
  absentees: text,
  /* ผู้เข้าร่วมเพิ่มเติมที่อาจไม่ใช่กรรมการ */
  participants: text,
  /* เวลาเปิดประชุมแบบข้อความจากช่องเวลา */
  startTime: text,
  /* เวลาเลิกประชุม แสดงก่อนส่วนลงนาม */
  endTime: text,
  /* ชื่อผู้จดรายงานการประชุม ใช้กับ recorderPosition/recorderRole */
  recorder: text,
  /* ข้อความวันมีผลใช้บังคับของคำสั่ง/ระเบียบ ไม่ใช่วันที่จัดทำเอกสาร */
  effectiveDate: text,
});
/* ชนิด Draft: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
/* z.infer<typeof documentSchema> อ่านชนิดจาก schema: typeof คือชนิดของค่าที่ประกาศไว้ ไม่ได้เรียก schema; เพิ่มช่องที่ schema แล้ว Draft เปลี่ยนตามอัตโนมัติ */
export type Draft = z.infer<typeof documentSchema>;
/* ชนิด SavedDraft: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
/* เครื่องหมาย & รวม Draft กับ metadata การจัดเก็บ; id/version ไม่ใช่ช่องให้ผู้ใช้กรอก version ต้องใช้ส่งกลับตอนแก้เพื่อกันข้อมูลชนกัน */
export type SavedDraft = Draft & {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  driveFileId: string | null;
  syncedVersion: number | null;
};
/* คำนวณวันปัจจุบันตาม Asia/Bangkok ไม่พึ่ง timezone ของเครื่อง server */
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
/* ให้ schema สร้างค่าเริ่มต้นทั้งหมดจากประเภท เรื่อง และวัน เพื่อไม่ทำ default ซ้ำหลายฟอร์ม */
export function newDraft(type: DocumentType = "external"): Draft {
  return documentSchema.parse({
    type,
    subject: "ร่างหนังสือใหม่",
    date: today(),
  });
}
/* แปลงวันที่ ISO ค.ศ. เป็นข้อความไทย/พ.ศ. สำหรับแสดงผล โดยไม่แก้ค่าที่จัดเก็บ */
export function thaiDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const d = new Date(value + "T00:00:00+07:00");
  return isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
        .format(d)
        .replace("พ.ศ. ", "");
}
/* คำนวณปีที่ใช้จัดหมวดข้อมูล; ปีงบประมาณเปลี่ยนตั้งแต่เดือนตุลาคม */
export function documentYear(date: string, mode: "calendar" | "fiscal") {
  /* ส่วน [year, month] ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  const [year, month] = date.split("-").map(Number);
  return year + 543 + (mode === "fiscal" && month >= 10 ? 1 : 0);
}
/* สะสมจุดที่ยังขาดให้ UI แสดง และให้ Server Action ตรวจอีกครั้งก่อนรับสถานะ reviewed */
export function reviewIssues(d: Draft): string[] {
  /* รายการจุดที่ต้องแก้จาก reviewIssues ใช้แสดงคำเตือน ไม่ใช่การแก้ข้อมูลให้ผู้ใช้ */
  const issues: string[] = [];
  if (!d.date) issues.push("ระบุวันที่หนังสือก่อนตรวจทานและส่งออก");
  if (!d.organization.trim()) issues.push("ระบุส่วนราชการเจ้าของหนังสือ");
  if (!bodySections(d).some((s) => s.text.trim()))
    issues.push("ระบุเนื้อหาหนังสือ");
  if (d.proposers.some((p) => !p.name.trim() || !p.position.trim()))
    issues.push("ระบุชื่อและตำแหน่งผู้เสนอเพิ่มเติมให้ครบ");
  if (d.opinions.some((p) => !p.title.trim()))
    issues.push("ระบุหัวข้อความเห็นทุกส่วน");
  if (d.confidentiality !== "ปกติ" && d.secretSetNumber > d.secretSetTotal)
    issues.push("เลขที่ชุดต้องไม่เกินจำนวนชุดทั้งหมด");
  if (
    ["external", "internal", "stamped", "memorandum"].includes(d.type) &&
    !d.recipient.trim()
  )
    issues.push("ระบุผู้รับหนังสือ");
  if (
    ["external", "internal", "stamped", "order", "certificate"].includes(
      d.type,
    ) &&
    !d.number.trim()
  )
    issues.push("ตรวจและระบุเลขที่หนังสือจากทะเบียนของหน่วยงาน");
  if (!["stamped", "news", "statement", "minutes", "other"].includes(d.type)) {
    if (!d.signer.trim()) issues.push("ระบุชื่อผู้ลงนาม");
    if (!d.position.trim()) issues.push("ระบุตำแหน่งผู้ลงนาม");
  }
  if (d.type === "external" && !d.address.trim())
    issues.push("ระบุที่อยู่ส่วนราชการ");
  if (d.type === "external" && !d.closing.trim())
    issues.push("ตรวจคำลงท้ายตามฐานะผู้รับ");
  if (d.type === "minutes") {
    if (d.minutesMode === "agenda") {
      if (!d.meetingAgenda.length)
        issues.push("เพิ่มอย่างน้อยหนึ่งวาระการประชุม");
      if (
        d.meetingAgenda.some(
          (a) =>
            !a.title.trim() ||
            (!a.discussion.trim() &&
              !a.speeches?.some((s) => s.text.trim()) &&
              !(
                a.torDetails && d.minutesTor.sections.some((s) => s.body.trim())
              )),
        )
      )
        issues.push("ระบุหัวข้อและข้ออภิปรายของทุกวาระ (มติกรอกเมื่อมี)");
    }
    if (d.minutesAttendanceMode === "table") {
      if (
        !d.meetingMembers.some((m) => m.status === "present" && m.name.trim())
      )
        issues.push("เพิ่มผู้มาประชุมอย่างน้อยหนึ่งคนในตาราง");
      if (d.meetingMembers.some((m) => !m.name.trim() || !m.position.trim()))
        issues.push("ระบุชื่อและตำแหน่งผู้เข้าประชุมในตารางให้ครบ");
    } else if (!d.attendees.trim()) issues.push("ระบุผู้มาประชุม");
    if (d.meetingSigners.some((m) => !m.name.trim() || !m.role.trim()))
      issues.push("ระบุชื่อและบทบาทผู้ลงนามท้ายรายงานให้ครบ");
    if (
      d.minutesMode === "agenda" &&
      d.meetingAgenda.some((a) => a.torDetails) &&
      d.minutesTor.sections.some((s) => !s.title.trim() || !s.body.trim())
    )
      issues.push("กรอกหัวข้อและรายละเอียด TOR ให้ครบ หรือลบหัวข้อที่ไม่ใช้");
    if (
      d.minutesMode === "agenda" &&
      d.meetingAgenda.some((a) =>
        a.speeches?.some((s) => !s.speaker.trim() || !s.text.trim()),
      )
    )
      issues.push("ระบุผู้พูดและข้อความอภิปรายให้ครบ");
    for (const [field, label] of [
      ["meetingNo", "ครั้งที่ประชุม"],
      ["location", "สถานที่ประชุม"],
      ["startTime", "เวลาเริ่มประชุม"],
      ["endTime", "เวลาเลิกประชุม"],
      ["recorder", "ผู้จดรายงานการประชุม"],
    ] as const)
      if (!d[field].trim()) issues.push("ระบุ" + label);
  }
  if (
    d.type === "certificate" &&
    d.certificatePhotoArea &&
    !d.certificateRecipient.trim()
  )
    issues.push("ระบุชื่อผู้ได้รับการรับรองใต้ช่องรูปถ่าย");
  return issues;
}
export const statusLabels = { draft: "ฉบับร่าง", reviewed: "ตรวจทานแล้ว" };
/* เปลี่ยนเลขอารบิก/ไทยเฉพาะข้อความแสดงผล รักษาค่าต้นฉบับของ Draft ไว้ */
export function numerals(value: string, style: Draft["numeralStyle"]) {
  if (style === "original") return value;
  const latin = value.replace(/[๐-๙]/g, (c) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
  return style === "arabic"
    ? latin
    : latin.replace(/[0-9]/g, (c) => "๐๑๒๓๔๕๖๗๘๙"[Number(c)]);
}
/* จุดรวมลำดับเนื้อหา: ถ้าจะสลับหัวข้อ หรือเพิ่มข้อความผู้พูด/TOR ในผลพิมพ์ ให้เริ่มตรวจที่นี่ */
/* จุดเชื่อมการพิมพ์: Workspace → documentHtml ใน render-document.ts → bodySections ตรงนี้ → วาด heading/body เป็นย่อหน้า; เพิ่มข้อมูลใหม่แล้วลืมตรงนี้จะบันทึกได้แต่ไม่ออกเอกสาร */
export type BodySection = {
  title: string;
  text: string;
  speaker?: { name: string; role: string };
};
export function bodySections(d: Draft): BodySection[] {
  if (d.type === "minutes" && d.minutesMode === "agenda")
    return [
      ...((d.minutesTor.appointmentNumber ||
        d.minutesTor.appointmentDate ||
        d.minutesTor.authority ||
        d.minutesTor.budget ||
        d.minutesTor.priceReference) &&
      d.meetingAgenda.some((a) => a.torDetails)
        ? [
            {
              title: "ข้อมูลประกอบการพิจารณา",
              text: [
                d.minutesTor.appointmentNumber
                  ? "คำสั่งแต่งตั้งเลขที่ " + d.minutesTor.appointmentNumber
                  : "",
                d.minutesTor.appointmentDate
                  ? "ลงวันที่ " + thaiDate(d.minutesTor.appointmentDate)
                  : "",
                d.minutesTor.authority
                  ? "ผู้แต่งตั้ง / หน่วยงาน " + d.minutesTor.authority
                  : "",
                d.minutesTor.budget
                  ? "วงเงินงบประมาณ " + d.minutesTor.budget
                  : "",
                d.minutesTor.priceReference
                  ? "แหล่งอ้างอิงราคา / มาตรฐาน " + d.minutesTor.priceReference
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ]
        : []),
      { title: "", text: d.minutesIntroduction },
      ...d.meetingAgenda.flatMap((a, i) => [
        { title: `ระเบียบวาระที่ ${i + 1}  ${a.title}`, text: a.discussion },
        ...(a.torDetails ? torDetailSections(d) : []),
        ...(a.speeches || []).map((s) => ({
          speaker: { name: s.speaker, role: s.role },
          title: [s.role, s.speaker ? "(" + s.speaker + ")" : ""]
            .filter(Boolean)
            .join(" "),
          text: s.text,
        })),
        ...(a.resolution.trim()
          ? [{ title: a.resolutionLabel, text: a.resolution }]
          : []),
      ]),
    ];
  return d.bodyMode === "free"
    ? [{ title: "", text: d.body }]
    : [
        { title: "เรื่องเดิม", text: d.background },
        { title: "ข้อเท็จจริง", text: d.facts },
        { title: "ข้อระเบียบ/กฎหมาย", text: d.legalBasis },
        { title: "ข้อพิจารณา", text: d.consideration },
        { title: "", text: d.proposal },
      ];
}
