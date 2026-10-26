/**
 * แผนที่อ่านโค้ด — src/lib/minutes-presets.ts
 * หน้าที่: แม่แบบประชุมทั่วไป / TOR งานซื้อ / TOR งานจ้าง สร้างเฉพาะโครง ไม่สมมติราคา สเปก หรือมติให้ผู้ใช้
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./document.ts
 * 2. ./minutes-presets.ts ← คุณอยู่ที่นี่
 * 3. ../components/minutes-details.tsx
 * 4. ../components/minutes-editor.tsx
 * 5. ../components/minutes-speeches-editor.tsx
 * 6. ../components/workspace.tsx
 * 7. ../app/actions.ts
 * 8. ./render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/minutes-details.tsx, ./document.ts, ../../tests/fixtures/tor-minutes.ts, ../../tests/tor-minutes.test.ts
 * อ่านต่อจาก import: ./document.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "./document";
/* เพิ่มแม่แบบ: เพิ่ม id/name/description ที่รายการนี้ → เพิ่ม id ใน minutesPreset ของ document.ts → ปรับ minutesPresetPatch → ทดสอบใน tests/tor-minutes.test.ts; เปลี่ยนเฉพาะชื่อไม่ต้องเพิ่ม id */
export const minutesPresets = [
  {
    id: "general",
    name: "ประชุมทั่วไป",
    description: "วาระมาตรฐาน 5 เรื่อง ปรับชื่อและมติได้",
  },
  {
    id: "tor-purchase",
    name: "ประชุม TOR / คุณลักษณะเฉพาะพัสดุ",
    description:
      "คำสั่งแต่งตั้ง รายชื่อกรรมการ คุณลักษณะ เงื่อนไขส่งมอบและรับประกัน",
  },
  {
    id: "tor-service",
    name: "ประชุม TOR / ขอบเขตงานจ้าง",
    description: "ที่มา วัตถุประสงค์ ขอบเขตงาน ผลงานส่งมอบ และเงื่อนไขสัญญา",
  },
] as const;
/* ชนิด MinutesPresetId: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type MinutesPresetId = (typeof minutesPresets)[number]["id"];
/* ชื่อหัวข้อเริ่มต้นของ TOR งานซื้อ; เปลี่ยนค่าตรงนี้มีผลกับการใช้แม่แบบใหม่ ไม่เขียนทับหัวข้อที่ผู้ใช้กรอกในร่างเดิม */
const purchaseSections = [
  "ความเป็นมา",
  "วัตถุประสงค์",
  "รายละเอียดคุณลักษณะเฉพาะของพัสดุ",
  "เอกสารประกอบข้อเสนอและเงื่อนไขอื่น",
  "กำหนดเวลาและสถานที่ส่งมอบ",
  "การตรวจรับและเงื่อนไขการจ่ายเงิน",
  "การรับประกันและบริการหลังการขาย",
  "ค่าปรับและข้อกำหนดเพิ่มเติม",
];
/* ชื่อหัวข้อเริ่มต้นของ TOR งานจ้าง แยกจากงานซื้อเพื่อปรับตามเนื้องานได้ */
const serviceSections = [
  "ความเป็นมา",
  "วัตถุประสงค์",
  "ขอบเขตงานและวิธีดำเนินงาน",
  "คุณสมบัติและเอกสารประกอบข้อเสนอ",
  "ผลงานที่ต้องส่งมอบและกำหนดเวลา",
  "การตรวจรับและเงื่อนไขการจ่ายเงิน",
  "การรับประกันผลงาน",
  "ค่าปรับและข้อกำหนดเพิ่มเติม",
];
/* คืน Partial<Draft> เฉพาะช่องที่แม่แบบปรับ; append รักษาวาระเดิม ส่วน replace ต้องให้ UI ถามก่อนเรียก */
export function minutesPresetPatch(
  draft: Draft,
  id: MinutesPresetId,
  mode: "append" | "replace",
): Partial<Draft> {
  const tor = id !== "general",
    alreadyHasDetails =
      mode === "append" && draft.meetingAgenda.some((a) => a.torDetails);
  const titles = [
    "เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ",
    "รับรองรายงานการประชุมครั้งที่ผ่านมา",
    "เรื่องเพื่อทราบ",
    tor
      ? "พิจารณาร่างขอบเขตของงาน (TOR) / รายละเอียดคุณลักษณะเฉพาะ"
      : "เรื่องเสนอเพื่อพิจารณา",
    "เรื่องอื่น ๆ",
  ];
  /* ส่วน agenda ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  const agenda: Draft["meetingAgenda"] = titles.map((title, index) => ({
    title,
    discussion: "",
    resolution: "",
    resolutionLabel: "มติที่ประชุม",
    ...(tor && index === 3 && !alreadyHasDetails ? { torDetails: true } : {}),
  }));
  const meetingAgenda =
    mode === "append" ? [...draft.meetingAgenda, ...agenda] : agenda;
  if (meetingAgenda.length > 50)
    throw Error("เพิ่มแม่แบบแล้วเกิน 50 วาระ กรุณาลดวาระเดิมก่อน");
  return {
    minutesPreset: id,
    minutesMode: "agenda",
    meetingAgenda,
    ...(tor
      ? {
          minutesTitle:
            draft.minutesTitle ||
            "รายงานการประชุมคณะกรรมการจัดทำร่างขอบเขตของงาน (TOR)",
          minutesAttendanceMode: "table" as const,
          meetingMembers: draft.meetingMembers.length
            ? draft.meetingMembers
            : [
                {
                  name: "",
                  position: "",
                  role: "ประธานกรรมการ",
                  status: "present",
                  note: "",
                },
                {
                  name: "",
                  position: "",
                  role: "กรรมการ",
                  status: "present",
                  note: "",
                },
                {
                  name: "",
                  position: "",
                  role: "กรรมการและเลขานุการ",
                  status: "present",
                  note: "",
                },
              ],
          minutesTor: {
            ...draft.minutesTor,
            sections: draft.minutesTor.sections.length
              ? draft.minutesTor.sections
              : (id === "tor-purchase"
                  ? purchaseSections
                  : serviceSections
                ).map((title) => ({ title, body: "" })),
          },
        }
      : {}),
  };
}
/* แปลงหัวข้อ TOR เป็นคู่ title/text พร้อมหมายเลข ใช้ใน bodySections ของ document.ts */
export function torDetailSections(d: Draft) {
  return d.minutesTor.sections.map((s, i) => ({
    title: `${i + 1}. ${s.title}`,
    text: s.body,
  }));
}
