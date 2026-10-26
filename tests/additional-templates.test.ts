/**
 * แผนที่อ่านโค้ด — tests/additional-templates.test.ts
 * หน้าที่: กรณีทดสอบ additional-templates; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
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
import { it, expect } from "vitest";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema, newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../src/lib/render-document";
const assets = {
  regular: "data:font/ttf;base64,",
  bold: "data:font/ttf;base64,",
  garuda: "data:image/png;base64,",
  routingStamp: "data:image/png;base64,",
  copyMark: "data:image/png;base64,",
};
it("preserves legacy defaults and validates optional first-page margins", () => {
  expect(
    documentSchema.parse({
      type: "internal",
      date: "2026-09-21",
      subject: "เดิม",
    }).firstPageTop,
  ).toBe("15");
  expect(
    documentSchema.safeParse({ ...newDraft(), firstPageTop: "99" }).success,
  ).toBe(false);
});
it("adds the regulation subject and edition and only renders received-order authority on orders", () => {
  const regulation = documentHtml(
    { ...newDraft("regulation"), subject: "การปฏิบัติงาน", number: "2" },
    assets,
  );
  expect(regulation).toContain("ว่าด้วย การปฏิบัติงาน");
  expect(regulation).toContain("(ฉบับที่ 2)");
  const order = { ...newDraft("order"), orderReceivedBy: "นายกเทศมนตรี" };
  expect(documentHtml(order, assets)).toContain("รับคำสั่งนายกเทศมนตรี");
  expect(documentHtml({ ...order, type: "external" }, assets)).not.toContain(
    "รับคำสั่งนายกเทศมนตรี",
  );
});
