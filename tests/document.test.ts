/**
 * แผนที่อ่านโค้ด — tests/document.test.ts
 * หน้าที่: กรณีทดสอบ document; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/app/page.tsx
 * 2. ../src/components/workspace.tsx
 * 3. ../src/lib/document.ts
 * 4. ../src/app/actions.ts
 * 5. ../src/lib/db.ts
 * 6. ../src/lib/render-document.ts
 * 7. ../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/document.ts, ../src/lib/render-document.ts, ../src/lib/templates.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { describe, expect, it } from "vitest";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  documentSchema,
  documentYear,
  newDraft,
  reviewIssues,
  thaiDate,
} from "../src/lib/document";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
/* นำเข้า ../src/lib/templates.ts — ทะเบียนประเภทหนังสือ หมวด ชื่อ คำแนะนำ และข้อมูลหน่วยงานตัวอย่าง */
import { groups, templates } from "../src/lib/templates";
const assets = {
  regular: "data:font/ttf;base64,",
  bold: "data:font/ttf;base64,",
  garuda: "data:image/png;base64,",
  routingStamp: "data:image/png;base64,",
  copyMark: "data:image/png;base64,",
};
describe("Thai correspondence", () => {
  it("covers 6 categories and 13 subtypes", () => {
    expect(groups).toHaveLength(6);
    expect(templates).toHaveLength(13);
  });
  it("uses document date and handles the October fiscal boundary", () => {
    expect(documentYear("2026-09-30", "fiscal")).toBe(2569);
    expect(documentYear("2026-10-01", "fiscal")).toBe(2570);
    expect(documentYear("2026-12-31", "calendar")).toBe(2569);
    expect(documentYear("2027-01-01", "calendar")).toBe(2570);
  });
  it("rejects impossible dates and Buddhist years entered as Gregorian", () => {
    expect(
      documentSchema.safeParse({ ...newDraft(), date: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...newDraft(), date: "2569-09-08" }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...newDraft(), date: "2024-02-29" }).success,
    ).toBe(true);
  });
  it("keeps old drafts without a date readable and requires one before review", () => {
    const d = { ...newDraft("internal"), date: "" };
    expect(documentHtml(d, assets)).toContain(
      '<b>วันที่</b><span class="memo-value">&nbsp;</span>',
    );
    expect(documentSchema.safeParse(d).success).toBe(true);
    expect(reviewIssues(d)).toContain("ระบุวันที่หนังสือก่อนตรวจทานและส่งออก");
  });
  it("shows the opinion date by default and allows hiding it independently from the memo date", () => {
    const opinion = {
      title: "ความเห็นนายกเทศมนตรี",
      comment: "",
      name: "",
      position: "นายกเทศมนตรี",
      showDate: true,
      lines: 1,
    };
    const base = { ...newDraft("internal"), opinions: [opinion] };
    const html = documentHtml(base, assets);
    expect(html).toContain("<b>วันที่</b>");
    expect(html).toContain(
      "วันที่ ................................................</p>",
    );
    expect(html.match(/class="opinion-line"/g)).toHaveLength(1);
    const hidden = documentHtml(
      { ...base, opinions: [{ ...opinion, showDate: false }] },
      assets,
    );
    expect(hidden).toContain("<b>วันที่</b>");
    expect(hidden).not.toContain(
      "วันที่ ................................................</p>",
    );
    expect(documentSchema.safeParse(base).success).toBe(true);
  });
  it("formats a stable Bangkok Buddhist date", () => {
    expect(thaiDate("2026-09-08")).toBe("8 กันยายน 2569");
  });
  it("adds an editable appendix title and groups at most two images on each appendix page", () => {
    const base = {
      ...newDraft("external"),
      appendixTitle: "ภาพประกอบแสดงอุปกรณ์",
      appendixImages: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "landscape-a.png",
          mime: "image/png" as const,
          bytes: 100,
          width: 1600,
          height: 900,
          caption: "อุปกรณ์หมายเลข 1",
          widthMm: 165,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "landscape-b.png",
          mime: "image/png" as const,
          bytes: 100,
          width: 1600,
          height: 900,
          caption: "อุปกรณ์หมายเลข 2",
          widthMm: 165,
        },
      ],
    };
    const html = documentHtml(base, assets, {
      [base.appendixImages[0].id]: "data:image/png;base64,IMAGE_A",
      [base.appendixImages[1].id]: "data:image/png;base64,IMAGE_B",
    });
    expect(html).toContain("appendix-sheet landscape-pair");
    expect(html).toContain("ภาพประกอบแสดงอุปกรณ์");
    expect(html).toContain("ภาพที่ 1 อุปกรณ์หมายเลข 1");
    expect(html).toContain("IMAGE_B");
    expect(documentSchema.parse(newDraft()).appendixLayout).toBe("auto");
  });
  it("validates required meeting fields independently of letters", () => {
    const d = newDraft("minutes"),
      issues = reviewIssues(d).join(" ");
    expect(issues).toContain("ผู้จดรายงาน");
    expect(issues).toContain("สถานที่");
    expect(issues).not.toContain("ผู้รับหนังสือ");
  });
  it("escapes user content and prevents script injection", () => {
    const html = documentHtml(
      {
        ...newDraft(),
        subject: "<script>alert(1)</script>",
        body: '<img src=x onerror="alert(1)"> & ข้อความ',
      },
      assets,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp;");
  });
  it("keeps reference and attachment fields out of internal memo headings", () => {
    const d = {
      ...newDraft("internal"),
      reference: "REFERENCE_MARKER",
      attachments: "ATTACHMENT_MARKER",
    };
    const html = documentHtml(d, assets);
    expect(html).toContain("บันทึกข้อความ");
    expect(html).not.toContain("REFERENCE_MARKER");
    expect(html).not.toContain("ATTACHMENT_MARKER");
  });
  it("renders distinct stamped and order structures", () => {
    const stamped = documentHtml(
      {
        ...newDraft("stamped"),
        recipient: "TEST_RECIPIENT",
        closing: "CLOSING_MARKER",
      },
      assets,
    );
    expect(stamped).toContain("ถึง");
    expect(stamped).toContain("TEST_RECIPIENT");
    expect(stamped).not.toContain("CLOSING_MARKER");
    expect(documentHtml(newDraft("order"), assets)).toContain("สั่ง ณ วันที่");
  });
});
