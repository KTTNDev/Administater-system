/**
 * แผนที่อ่านโค้ด — tests/document-tools.test.ts
 * หน้าที่: กรณีทดสอบ document-tools; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
 * อ่านต่อจาก import: ../src/lib/document.ts, ../src/lib/render-document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { describe, it, expect } from "vitest";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  documentSchema,
  newDraft,
  numerals,
  bodySections,
  reviewIssues,
} from "../src/lib/document";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
const assets = {
  regular: "data:font/ttf;base64,123",
  bold: "data:font/ttf;base64,123",
  garuda: "data:image/png;base64,123",
  routingStamp: "data:image/png;base64,ROUTING_STAMP",
  copyMark: "data:image/png;base64,COPY_MARK",
};
describe("extended drafting tools", () => {
  it("loads historical drafts without dropping their body", () => {
    const d = documentSchema.parse({
      type: "internal",
      subject: "เดิม",
      date: "2026-09-09",
      body: "เดิม 123",
    });
    expect(d.opinions).toEqual([]);
    expect(d.copyMark).toBe("none");
    expect(bodySections(d)[0].text).toBe("เดิม 123");
  });
  it("orders structured sections like the example while preserving older drafts", () => {
    const d = documentSchema.parse({
      type: "internal",
      subject: "ร่างเดิม",
      bodyMode: "structured",
      background: "เรื่องเดิม",
      legalBasis: "ข้อกฎหมาย",
      consideration: "ข้อพิจารณา",
      proposal: "จึงเรียนมาเพื่อโปรดพิจารณา",
    });
    expect(d.facts).toBe("");
    expect(bodySections(d).map((s) => s.title)).toEqual([
      "เรื่องเดิม",
      "ข้อเท็จจริง",
      "ข้อระเบียบ/กฎหมาย",
      "ข้อพิจารณา",
      "",
    ]);
    expect(bodySections(d).map((s) => s.text)).toEqual([
      "เรื่องเดิม",
      "",
      "ข้อกฎหมาย",
      "ข้อพิจารณา",
      "จึงเรียนมาเพื่อโปรดพิจารณา",
    ]);
  });
  it("converts mixed numerals reversibly without changing punctuation", () => {
    expect(numerals("12/๒๕๖๙", "thai")).toBe("๑๒/๒๕๖๙");
    expect(numerals("๑๒/2569", "arabic")).toBe("12/2569");
  });
  it("renders structured content and preserves inactive free text", () => {
    const d = {
      ...newDraft(),
      body: "OLD_BODY",
      bodyMode: "structured" as const,
      legalBasis: "ข้อ 12",
    };
    expect(reviewIssues(d)).not.toContain("ระบุเนื้อหาหนังสือ");
    const html = documentHtml(d, assets);
    expect(html).toContain("ข้อ 12");
    expect(html).not.toContain("OLD_BODY");
    expect(d.body).toBe("OLD_BODY");
  });
  it("renders bold markdown and simple tables while escaping cell text", () => {
    const html = documentHtml(
      {
        ...newDraft(),
        body: "**ข้อความสำคัญ**\n| รายการ | จำนวน |\n| --- | --- |\n| ปากกา | 2 |",
      },
      assets,
    );
    expect(html).toContain("<strong>ข้อความสำคัญ</strong>");
    expect(html).toContain('<table class="document-table">');
    expect(html).toContain("<th>รายการ</th>");
    expect(html).toContain("<td>ปากกา</td>");
  });
  it("keeps font data and email intact when converting document numerals", () => {
    const html = documentHtml(
      {
        ...newDraft(),
        number: "12/2569",
        email: "office123@example.com",
        numeralStyle: "thai",
      },
      assets,
    );
    expect(html).toContain("๑๒/๒๕๖๙");
    expect(html).toContain("office123@example.com");
    expect(html).toContain(assets.regular);
  });
  it("places the transparent counterpart PNG in front of the page content", () => {
    const html = documentHtml(
      { ...newDraft("external"), copyMark: "สำเนาคู่ฉบับ" },
      assets,
    );
    expect(html).toContain(
      "left:50%;top:1mm;transform:translateX(-50%);width:38mm",
    );
    expect(html).toContain("z-index:21;pointer-events:none");
    expect(html).toContain('s.src="data:image/png;base64,COPY_MARK"');
    expect(html).toContain("s.alt='สำเนาคู่ฉบับ'");
  });
  it("renders the supplied routing-stamp image as a foreground overlay near the paper edge", () => {
    const html = documentHtml(
      {
        ...newDraft("external"),
        productionMark: true,
        drafter: "เจ้าหน้าที่ร่าง",
      },
      assets,
    );
    expect(html).toContain("className='routing-stamp'");
    expect(html).toContain(assets.routingStamp);
    expect(html).toContain(
      "right:5mm;bottom:5mm;width:82mm;height:auto;z-index:21",
    );
    expect(html).not.toContain("production-row");
  });
  it("creates a two-set counterpart in one draft and only marks the duplicate", () => {
    const html = documentHtml(
      {
        ...newDraft("external"),
        copyMark: "สำเนาคู่ฉบับ",
        productionMark: true,
      },
      assets,
    );
    expect(html).toContain("await paginate(sourceNodes,false)");
    expect(html).toContain(
      "await paginate(sourceNodes.map(node=>node.cloneNode(true)),true)",
    );
    expect(html).toContain("copy&&copyPages===1");
    expect(html).toContain("className='copy-mark'");
    expect(html).toContain("className='routing-stamp'");
    expect(html).toContain('<div class="signoff-group"><p class="closing"');
    expect(html).toContain(
      ".signoff-group{display:flow-root;break-inside:avoid;page-break-inside:avoid}",
    );
    expect(html).toContain(
      ".signoff-group>.closing{margin-left:75mm;text-align:left;margin-top:12pt;width:max-content",
    );
    expect(html).toContain(
      ".signoff-group .signature{margin-left:0;width:60mm;text-align:center}",
    );
    expect(html).toContain(
      "signature.style.marginLeft=Math.round(closeBox.left+closeBox.width/2-contentBox.left-signatureWidth/2)",
    );
    expect(html).toContain(
      "body.compact-signoff.correspondence .page:first-child .content>.body-text",
    );
  });
  it("limits opinions and escapes all opinion and stamp names", () => {
    const item = {
      title: "<script>bad</script>",
      comment: "",
      name: "",
      position: "",
      lines: 3,
    };
    expect(
      documentSchema.safeParse({ ...newDraft(), opinions: Array(6).fill(item) })
        .success,
    ).toBe(false);
    const d = documentSchema.parse({
      ...newDraft("internal"),
      opinions: [item],
      productionMark: true,
      drafter: "<img src=x>",
    });
    const html = documentHtml(d, assets);
    expect(html).toContain("&lt;script&gt;bad");
    expect(html).not.toContain("<script>bad");
    expect(html).toContain("&lt;img src=x&gt;");
  });
});
