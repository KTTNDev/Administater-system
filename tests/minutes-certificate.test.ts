/**
 * แผนที่อ่านโค้ด — tests/minutes-certificate.test.ts
 * หน้าที่: กรณีทดสอบ minutes-certificate; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
 * อ่านต่อจาก import: ../src/lib/document.ts, ../src/lib/render-document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { it, expect } from "vitest";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  bodySections,
  documentSchema,
  newDraft,
  reviewIssues,
} from "../src/lib/document";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
const assets = {
  regular: "data:font/ttf;base64,",
  bold: "data:font/ttf;base64,",
  garuda: "data:image/png;base64,",
  routingStamp: "data:image/png;base64,",
  copyMark: "data:image/png;base64,",
};
it("keeps legacy reports and switches agenda content without destroying free text", () => {
  const old = documentSchema.parse({
    type: "minutes",
    subject: "ประชุม",
    date: "2026-09-25",
    body: "ข้อความเดิม",
  });
  expect(old.minutesMode).toBe("free");
  expect(old.certificatePhotoArea).toBe(false);
  const draft = {
    ...old,
    minutesMode: "agenda" as const,
    sectionHeadings: false,
    meetingAgenda: [
      {
        title: "งบประมาณ",
        discussion: "อภิปราย <script>",
        resolution: "รับทราบ",
        resolutionLabel: "ข้อสรุป" as const,
      },
    ],
  };
  const html = documentHtml(draft, assets);
  expect(html).toContain("ระเบียบวาระที่ 1  งบประมาณ");
  expect(html).toContain("อภิปราย &lt;script&gt;");
  expect(html).toContain("ข้อสรุป");
  expect(html).not.toContain("ข้อความเดิม");
  expect(bodySections({ ...draft, minutesMode: "free" })[0].text).toBe(
    "ข้อความเดิม",
  );
  expect(reviewIssues(draft)).not.toContain("ระบุเนื้อหาหนังสือ");
  expect(reviewIssues({ ...draft, meetingAgenda: [] })).toContain(
    "เพิ่มอย่างน้อยหนึ่งวาระการประชุม",
  );
  expect(
    documentSchema.safeParse({
      ...draft,
      meetingAgenda: Array(51).fill(draft.meetingAgenda[0]),
    }).success,
  ).toBe(false);
});
it("only prints certificate photo and recipient block when requested on a certificate", () => {
  const draft = {
    ...newDraft("certificate"),
    certificatePhotoArea: true,
    certificateRecipient: "ผู้รับการรับรอง",
  };
  expect(documentHtml(draft, assets)).toContain(
    '<div class="certificate-photo">',
  );
  expect(
    documentHtml({ ...draft, certificatePhotoArea: false }, assets),
  ).not.toContain('<div class="certificate-photo">');
  expect(documentHtml({ ...draft, type: "external" }, assets)).not.toContain(
    '<div class="certificate-photo">',
  );
  expect(reviewIssues({ ...draft, certificateRecipient: "" })).toContain(
    "ระบุชื่อผู้ได้รับการรับรองใต้ช่องรูปถ่าย",
  );
});
