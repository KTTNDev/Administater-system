/**
 * แผนที่อ่านโค้ด — tests/e2e/printing-guidelines.spec.ts
 * หน้าที่: กรณีทดสอบ printing-guidelines; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../../src/app/page.tsx
 * 2. ../../src/components/workspace.tsx
 * 3. ../../src/lib/document.ts
 * 4. ../../src/app/actions.ts
 * 5. ../../src/lib/db.ts
 * 6. ../../src/lib/render-document.ts
 * 7. ../../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../../src/lib/render-document.ts, ../../src/lib/document.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { test, expect } from "@playwright/test";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า ../../src/lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "../../src/lib/render-document";
/* นำเข้า ../../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../../src/lib/document";
const data = (file: string, mime: string) =>
  `data:${mime};base64,${fs.readFileSync("public/" + file).toString("base64")}`;
const assets = {
  regular: data("fonts/THSarabunNew.ttf", "font/ttf"),
  bold: data("fonts/THSarabunNew-Bold.ttf", "font/ttf"),
  garuda: data("assets/garuda.png", "image/png"),
  routingStamp: data("assets/approval-routing-stamp.png", "image/png"),
  copyMark: data("assets/copy-counterpart.png", "image/png"),
};
for (const type of ["external", "internal"] as const)
  test(`${type} follows the supplied printing measurements`, async ({
    page,
  }) => {
    const d = {
      ...newDraft(type),
      subject: "ขอเชิญประชุมจัดทำแผนการดำเนินงาน",
      date: "2026-09-21",
      number: "มท ๐๐๐๐/๑๒๓",
      organization: "สำนักงานเทศบาลตัวอย่าง",
      department: "สำนักปลัดเทศบาล",
      address: "อำเภอเมือง จังหวัดตัวอย่าง ๑๐๐๐๐",
      phone: "๐ ๒๐๐๐ ๐๐๐๐",
      recipient: "หัวหน้าส่วนราชการทุกส่วน",
      signer: "ชื่อ นามสกุล (ตัวอย่าง)",
      position: "นายกเทศมนตรีตัวอย่าง",
      body: "ด้วยสำนักงานเทศบาลตัวอย่างกำหนดจัดประชุมเพื่อพิจารณาแผนการดำเนินงานของหน่วยงาน และเตรียมข้อมูลสำหรับการให้บริการประชาชน\nในการนี้ จึงขอเชิญท่านเข้าร่วมประชุมตามวัน เวลา และสถานที่ที่หน่วยงานกำหนด พร้อมจัดเตรียมข้อมูลที่เกี่ยวข้อง\nจึงเรียนมาเพื่อโปรดพิจารณาเข้าร่วมประชุม",
      urgency: type === "external" ? ("ด่วน" as const) : ("ปกติ" as const),
      confidentiality:
        type === "external" ? ("ลับ" as const) : ("ปกติ" as const),
      memoGuides: false,
    };
    await page.setContent(documentHtml(d, assets));
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __paginationDone: boolean }).__paginationDone,
    );
    const measured = await page.evaluate(() => {
      const p = document.querySelector(".page")!,
        g = document.querySelector(".garuda")!,
        body = document.querySelector(".body-text")!,
        sig = document.querySelector(".signature")!,
        space = document.querySelector(".sign-space")!,
        signer = sig.querySelector("p")!;
      const style = getComputedStyle(p),
        b = getComputedStyle(body),
        heading = document.querySelector(".memo-head strong");
      const owner = document.querySelector(".contact"),
        ownerRow = owner?.nextElementSibling,
        urgency = document.querySelector(".urgency"),
        security = document.querySelector(".security:not(.bottom)");
      return {
        left: parseFloat(style.paddingLeft),
        right: parseFloat(style.paddingRight),
        top: g.getBoundingClientRect().top - p.getBoundingClientRect().top,
        garuda: g.getBoundingClientRect().height,
        indent: parseFloat(b.textIndent),
        before: parseFloat(b.marginTop),
        lineHeight: b.lineHeight,
        signBlank: space.getBoundingClientRect().height,
        oneLine: signer.getBoundingClientRect().height,
        heading: heading
          ? {
              size: getComputedStyle(heading).fontSize,
              line: getComputedStyle(heading).lineHeight,
            }
          : null,
        dots: [...document.querySelectorAll(".memo-value")].map(
          (e) => getComputedStyle(e, "::after").borderBottomStyle,
        ),
        closing: document.querySelector(".closing")
          ? parseFloat(
              getComputedStyle(document.querySelector(".closing")!).marginTop,
            )
          : null,
        contact: owner ? parseFloat(getComputedStyle(owner).marginTop) : null,
        contactRow: ownerRow
          ? parseFloat(getComputedStyle(ownerRow).marginTop)
          : null,
        urgencyTop: urgency ? parseFloat(getComputedStyle(urgency).top) : null,
        securityLeft: security
          ? parseFloat(getComputedStyle(security).left)
          : null,
      };
    });
    const mm = 96 / 25.4;
    expect(measured.left).toBeCloseTo(30 * mm, 1);
    expect(measured.right).toBeCloseTo(20 * mm, 1);
    expect(measured.top).toBeCloseTo(15 * mm, 1);
    expect(measured.garuda).toBeCloseTo(
      (type === "internal" ? 15 : 30) * mm,
      1,
    );
    expect(measured.indent).toBeCloseTo(25 * mm, 1);
    expect(measured.before).toBe(8);
    expect(parseFloat(measured.lineHeight)).toBeCloseTo((16 * 96) / 72, 1);
    expect(measured.signBlank).toBeCloseTo(measured.oneLine * 3, 0);
    if (type === "internal") {
      expect(parseFloat(measured.heading!.size)).toBeCloseTo((29 * 96) / 72, 2);
      expect(parseFloat(measured.heading!.line)).toBeCloseTo((35 * 96) / 72, 2);
      expect(measured.dots).toEqual(["dotted", "dotted", "dotted", "dotted"]);
    } else {
      expect(measured.closing).toBe(16);
      expect(measured.contact).toBe(8);
      expect(measured.contactRow).toBe(8);
      expect(measured.urgencyTop).toBeCloseTo(27 * mm, 1);
      expect(measured.securityLeft).toBeCloseTo(115 * mm, 1);
    }
    expect(
      await page.evaluate(
        () => (window as unknown as { __overflow: boolean }).__overflow,
      ),
    ).toBe(false);
    fs.mkdirSync("output/pdf", { recursive: true });
    await page.pdf({
      path: `output/pdf/printing-guidelines-${type}.pdf`,
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page
      .locator(".page")
      .first()
      .screenshot({ path: `output/printing-guidelines-${type}.png` });
  });
