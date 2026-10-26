/**
 * แผนที่อ่านโค้ด — tests/tor-minutes.test.ts
 * หน้าที่: กรณีทดสอบ tor-minutes; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/lib/document.ts
 * 2. ../src/lib/minutes-presets.ts
 * 3. ../src/components/minutes-details.tsx
 * 4. ../src/components/minutes-editor.tsx
 * 5. ../src/components/minutes-speeches-editor.tsx
 * 6. ../src/components/workspace.tsx
 * 7. ../src/app/actions.ts
 * 8. ../src/lib/render-document.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/document.ts, ../src/lib/minutes-presets.ts, ../src/lib/render-document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { describe, it, expect } from "vitest";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  bodySections,
  documentSchema,
  newDraft,
  reviewIssues,
} from "../src/lib/document";
/* นำเข้า ../src/lib/minutes-presets.ts — แม่แบบประชุมทั่วไป / TOR งานซื้อ / TOR งานจ้าง สร้างเฉพาะโครง ไม่สมมติราคา สเปก หรือมติให้ผู้ใช้ */
import { minutesPresetPatch } from "../src/lib/minutes-presets";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
const assets = {
  regular: "data:font/ttf;base64,",
  bold: "data:font/ttf;base64,",
  garuda: "",
  routingStamp: "",
  copyMark: "",
};
const tor = () => {
  const d = newDraft("minutes");
  return documentSchema.parse({
    ...d,
    ...minutesPresetPatch(d, "tor-purchase", "append"),
  });
};
describe("editable TOR meeting reports", () => {
  it("keeps old reports in free-text mode and adds no TOR content to them", () => {
    const d = documentSchema.parse({
      type: "minutes",
      subject: "ประชุมเดิม",
      date: "2026-10-26",
      body: "เนื้อหาเดิม",
    });
    expect(d.minutesPreset).toBe("general");
    expect(d.minutesAttendanceMode).toBe("text");
    expect(bodySections(d)).toEqual([{ title: "", text: "เนื้อหาเดิม" }]);
    expect(documentHtml(d, assets)).not.toContain(
      '<table class="document-table minutes-attendance">',
    );
  });
  it("starts with editable headings, never fabricated specifications, approval, or names", () => {
    const d = tor();
    expect(d.meetingAgenda).toHaveLength(5);
    expect(d.minutesTor.sections).toHaveLength(8);
    expect(d.meetingAgenda[3].torDetails).toBe(true);
    expect(d.meetingMembers).toHaveLength(3);
    expect(d.minutesTor.sections.every((s) => s.body === "")).toBe(true);
    expect(d.meetingMembers.every((m) => m.name === "")).toBe(true);
    expect(d.meetingAgenda.every((a) => a.resolution === "")).toBe(true);
  });
  it("appends without erasing existing agendas, free text, people, or TOR work", () => {
    const d = {
      ...tor(),
      body: "เก็บข้อความเดิม",
      meetingAgenda: [
        {
          title: "วาระเดิม",
          discussion: "อภิปรายเดิม",
          resolution: "มติเดิม",
          resolutionLabel: "มติที่ประชุม" as const,
        },
      ],
      minutesTor: {
        ...tor().minutesTor,
        sections: [{ title: "หัวข้อของเรา", body: "รายละเอียดที่เขียนเอง" }],
      },
    };
    const next = documentSchema.parse({
      ...d,
      ...minutesPresetPatch(d, "tor-service", "append"),
    });
    expect(next.meetingAgenda[0]).toEqual(d.meetingAgenda[0]);
    expect(next.meetingAgenda).toHaveLength(6);
    expect(next.body).toBe(d.body);
    expect(next.minutesTor.sections).toEqual(d.minutesTor.sections);
    const appended = documentSchema.parse({
      ...next,
      ...minutesPresetPatch(next, "tor-purchase", "append"),
    });
    expect(appended.meetingAgenda.filter((a) => a.torDetails)).toHaveLength(1);
    expect(() =>
      minutesPresetPatch(
        { ...d, meetingAgenda: Array(49).fill(d.meetingAgenda[0]) },
        "general",
        "append",
      ),
    ).toThrow("50");
  });
  it("replaces only agendas when explicitly requested and retains the editable TOR details", () => {
    const d = tor();
    d.meetingAgenda[0].discussion = "เดิม";
    d.minutesTor.sections[0].body = "ที่มาโครงการ";
    const next = documentSchema.parse({
      ...d,
      ...minutesPresetPatch(d, "tor-service", "replace"),
    });
    expect(next.meetingAgenda).toHaveLength(5);
    expect(next.meetingAgenda[0].discussion).toBe("");
    expect(next.minutesTor.sections[0].body).toBe("ที่มาโครงการ");
  });
  it("renders attendance, absences, speakers, technical sections, resolutions and all signers safely", () => {
    const d = tor();
    d.subject = "โครงการ <กล้อง>";
    d.recorder = "ผู้จดตัวอย่าง";
    d.recorderPosition = "เจ้าพนักงานธุรการ";
    d.meetingMembers = [
      {
        name: "กรรมการหนึ่ง",
        position: "ตำแหน่งหนึ่ง",
        role: "ประธานกรรมการ",
        status: "present",
        note: "หมายเหตุหนึ่ง",
      },
      {
        name: "กรรมการไม่มา",
        position: "ตำแหน่งสอง",
        role: "กรรมการ",
        status: "absent",
        note: "ติดราชการ",
      },
    ];
    d.meetingSigners = [
      { name: "กรรมการหนึ่ง", position: "ตำแหน่งหนึ่ง", role: "ประธานกรรมการ" },
    ];
    d.minutesTor.appointmentNumber = "123/2569";
    d.minutesTor.appointmentDate = "2026-10-26";
    d.minutesTor.sections = [
      {
        title: "สเปกที่กำหนดเอง",
        body: "**ข้อกำหนด** <script>\n| รายการ | จำนวน |\n| --- | --- |\n| กล้อง | 2 |",
      },
    ];
    d.meetingAgenda[3].speeches = [
      { speaker: "ผู้เสนอ <ชื่อ>", role: "กรรมการ", text: "คำถามและคำชี้แจง" },
    ];
    d.meetingAgenda[3].resolution = "ให้แก้ไขร่างก่อนเสนออีกครั้ง";
    const html = documentHtml(d, assets);
    for (const value of [
      "ลายมือชื่อ",
      "หมายเหตุหนึ่ง",
      "กรรมการไม่มา",
      "ติดราชการ",
      "123/2569",
      "26 ตุลาคม 2569",
      "สเปกที่กำหนดเอง",
      "คำถามและคำชี้แจง",
      "ให้แก้ไขร่างก่อนเสนออีกครั้ง",
      "ผู้จดตัวอย่าง",
      "ประธานกรรมการ",
      "&lt;script&gt;",
      "&lt;กล้อง&gt;",
    ])
      expect(html).toContain(value);
    expect(html).not.toContain("ผู้เสนอ <ชื่อ>");
    expect(html.match(/class="signature minutes-signature"/g)).toHaveLength(2);
    const sections = bodySections(d);
    expect(
      sections.findIndex((s) => s.title.includes("สเปกที่กำหนดเอง")),
    ).toBeGreaterThan(
      sections.findIndex((s) => s.title.includes("ระเบียบวาระที่ 4")),
    );
  });
  it("accepts a filled attendance table for review and detects incomplete TOR sections", () => {
    const d = tor();
    d.meetingNo = "1/2569";
    d.location = "ห้องประชุม";
    d.organization = "เทศบาลตัวอย่าง";
    d.startTime = "09:00";
    d.endTime = "12:00";
    d.recorder = "เลขานุการ";
    d.meetingMembers = [
      {
        name: "กรรมการ",
        position: "ตำแหน่ง",
        role: "ประธาน",
        status: "present",
        note: "",
      },
    ];
    d.meetingAgenda = d.meetingAgenda.map((a) => ({
      ...a,
      discussion: "รายละเอียดการประชุม",
    }));
    expect(reviewIssues(d)).not.toContain("ระบุผู้มาประชุม");
    expect(reviewIssues(d)).toContain(
      "กรอกหัวข้อและรายละเอียด TOR ให้ครบ หรือลบหัวข้อที่ไม่ใช้",
    );
    d.minutesTor.sections = d.minutesTor.sections.map((s) => ({
      ...s,
      body: "ข้อมูลที่กรอกแล้ว",
    }));
    expect(reviewIssues(d)).toEqual([]);
    d.meetingMembers[0].status = "absent";
    expect(reviewIssues(d)).toContain(
      "เพิ่มผู้มาประชุมอย่างน้อยหนึ่งคนในตาราง",
    );
  });
  it("validates dates and bounds and ignores TOR fields when free text is selected", () => {
    const d = tor();
    expect(
      documentSchema.safeParse({
        ...d,
        minutesTor: { ...d.minutesTor, appointmentDate: "2026-02-31" },
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...d,
        meetingMembers: Array(61).fill(d.meetingMembers[0]),
      }).success,
    ).toBe(false);
    d.minutesMode = "free";
    d.body = "ข้อความอิสระ";
    d.minutesTor.sections[0].body = "ซ่อนตอน free";
    expect(bodySections(d)).toEqual([{ title: "", text: "ข้อความอิสระ" }]);
  });
});
