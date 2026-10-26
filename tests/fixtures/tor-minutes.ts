/**
 * แผนที่อ่านโค้ด — tests/fixtures/tor-minutes.ts
 * หน้าที่: ข้อมูลสมมติสำหรับทดสอบ TOR ไม่ใช่รายงานหรือผลอนุมัติจริง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/lib/document.ts
 * 2. ../../src/lib/minutes-presets.ts
 * 3. ../../src/components/minutes-details.tsx
 * 4. ../../src/components/minutes-editor.tsx
 * 5. ../../src/components/minutes-speeches-editor.tsx
 * 6. ../../src/components/workspace.tsx
 * 7. ../../src/app/actions.ts
 * 8. ../../src/lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../e2e/tor-minutes.spec.ts
 * อ่านต่อจาก import: ../../src/lib/document.ts, ../../src/lib/minutes-presets.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ../../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft, documentSchema } from "../../src/lib/document";
/* นำเข้า ../../src/lib/minutes-presets.ts — แม่แบบประชุมทั่วไป / TOR งานซื้อ / TOR งานจ้าง สร้างเฉพาะโครง ไม่สมมติราคา สเปก หรือมติให้ผู้ใช้ */
import { minutesPresetPatch } from "../../src/lib/minutes-presets";
/* torMeetingFixture: ข้อมูลสมมติสำหรับทดสอบ TOR ไม่ใช่รายงานหรือผลอนุมัติจริง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function torMeetingFixture(long = false) {
  const base = newDraft("minutes");
  const d = documentSchema.parse({
    ...base,
    ...minutesPresetPatch(base, "tor-purchase", "append"),
    subject: "ตัวอย่างประชุมกำหนด TOR โครงการจัดซื้อกล้องบันทึกภาพ",
    organization: "เทศบาลตัวอย่าง",
    meetingNo: "1/2569",
    date: "2026-10-26",
    location: "ห้องประชุมหน่วยงานตัวอย่าง",
    startTime: "09:00",
    endTime: "12:00",
    recorder: "เลขานุการตัวอย่าง",
    recorderPosition: "เจ้าพนักงานธุรการ",
    recorderRole: "กรรมการและผู้จดรายงานการประชุม",
  });
  d.minutesIntroduction =
    "ตัวอย่างสำหรับตรวจรูปแบบเท่านั้น ไม่ใช่บันทึกการประชุมจริง";
  d.meetingMembers = Array.from({ length: long ? 40 : 3 }, (_, i) => ({
    name: `กรรมการตัวอย่าง ${i + 1}`,
    position: "ตำแหน่งตัวอย่าง",
    role: i === 0 ? "ประธานกรรมการ" : "กรรมการ",
    status: "present" as const,
    note: i === 0 ? "ตัวอย่าง" : "",
  }));
  d.minutesTor = {
    ...d.minutesTor,
    appointmentNumber: "ตัวอย่าง/2569",
    appointmentDate: "2026-10-20",
    authority: "หน่วยงานตัวอย่าง",
    budget: "ระบุตามเอกสารงบประมาณ (ตัวอย่าง)",
    priceReference: "ระบุมาตรฐานและแหล่งอ้างอิงตามงานจริง",
    sections: d.minutesTor.sections.map((s, i) => ({
      ...s,
      body:
        `ตัวอย่างรายละเอียดหัวข้อ ${i + 1} สำหรับตรวจการจัดหน้า เนื้อหาและเงื่อนไขต้องกรอกให้ตรงกับโครงการและหลักฐานที่ใช้พิจารณา `.repeat(
          long ? 16 : 2,
        ) + ` จบหัวข้อ TOR ${i + 1}`,
    })),
  };
  d.meetingAgenda = d.meetingAgenda.map((a, i) => ({
    ...a,
    discussion: `บันทึกข้ออภิปรายของวาระ ${i + 1} ตามการประชุมจริง`,
    resolution:
      i === 3 ? "ให้ทบทวนรายละเอียดและนำเสนอครั้งต่อไป (ตัวอย่าง)" : "",
  }));
  d.meetingAgenda[3].speeches = [
    {
      speaker: "กรรมการผู้ซักถาม",
      role: "กรรมการ",
      text: "ข้อซักถามตัวอย่างเรื่องการตรวจรับและเงื่อนไขการรับประกัน",
    },
    {
      speaker: "ผู้ชี้แจงตัวอย่าง",
      role: "กรรมการ",
      text: "คำชี้แจงตัวอย่าง ให้ระบุข้อมูลอ้างอิงก่อนสรุปผล",
    },
  ];
  d.meetingSigners = [
    { name: "กรรมการตัวอย่าง 2", position: "ตำแหน่งตัวอย่าง", role: "กรรมการ" },
    {
      name: "กรรมการตัวอย่าง 1",
      position: "ตำแหน่งตัวอย่าง",
      role: "ประธานกรรมการ",
    },
  ];
  return d;
}
