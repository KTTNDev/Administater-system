/**
 * แผนที่อ่านโค้ด — src/lib/pdf.ts
 * หน้าที่: เปิด HTML เอกสารด้วย Chromium แบบไม่แสดงหน้าต่าง รอจัดหน้า แล้วรวมไฟล์แนบเป็น PDF
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ../components/workspace.tsx
 * 3. ./document.ts
 * 4. ../app/actions.ts
 * 5. ./db.ts
 * 6. ./render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ./pdf.ts ← คุณอยู่ที่นี่
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/api/documents/[id]/pdf/route.ts, ../app/storage-actions.ts, ./drive.ts
 * อ่านต่อจาก import: ./document.ts, ./render-document.ts, ./assets.ts, ./attachments.ts, ./appendix.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
import { chromium } from "playwright";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "./document";
/* นำเข้า ./render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF */
import { documentHtml } from "./render-document";
/* นำเข้า ./assets.ts — อ่านฟอนต์และรูปตราจาก public แล้วแปลงเป็น data URL สำหรับเอกสารที่ไม่พึ่งไฟล์ภายนอก */
import { documentAssets } from "./assets";
/* นำเข้า ./attachments.ts — รับ PDF/ภาพ ตรวจเนื้อไฟล์ เก็บต้นฉบับและฉบับสำหรับพิมพ์ แล้วรวมท้าย PDF ของหนังสือ */
import { appendAttachments } from "./attachments";
/* นำเข้า ./appendix.ts — จัดเก็บภาพภาคผนวก ตรวจชนิด ขนาด และความตรงกันของข้อมูลภาพกับไฟล์จริง */
import { appendixSources, validateAppendixImages } from "./appendix";
/* ใช้ renderer เดียวกับ preview; รอ __paginationDone และตรวจ __overflow ก่อนสั่ง page.pdf แล้วรวมเอกสารแนบ */
export async function renderPdf(draft: Draft) {
  validateAppendixImages(draft);
  const sources = appendixSources(draft);
  const executablePath =
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find((p) => fs.existsSync(p));
  /* รอผลของงานก่อนกำหนด browser; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
  const browser = await chromium.launch({ headless: true, executablePath });
  /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
  try {
    /* รอผลของงานก่อนกำหนด page; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const page = await browser.newPage();
    /* เอกสารใช้ data URL อยู่แล้ว จึงบล็อก network ระหว่าง render ไม่ให้ HTML ไปดึงเว็บภายนอกโดยไม่จำเป็น */
    await page.route("**/*", (route) => route.abort());
    /* ส่ง HTML จาก renderer เดียวกับ preview เข้า browser; อย่าสร้างชุดกฎหน้ากระดาษอีกชุดที่นี่ เพราะจะทำให้ preview กับ PDF ไม่ตรงกัน */
    await page.setContent(documentHtml(draft, documentAssets(), sources), {
      waitUntil: "load",
    });
    /* รอสัญญาณจาก JavaScript จัดหน้าใน render-document.ts; load เสร็จอย่างเดียวไม่ได้แปลว่าฟอนต์/การแบ่งหน้าพร้อม */
    await page.waitForFunction(
      () =>
        (window as unknown as { __paginationDone: boolean }).__paginationDone,
      undefined,
      { timeout: 15000 },
    );
    if (
      await page.evaluate(
        () => (window as unknown as { __overflow: boolean }).__overflow,
      )
    )
      throw new Error(
        "มีส่วนของหนังสือยาวเกินหน้ากระดาษ กรุณาแบ่งข้อความก่อนส่งออก",
      );
    /* รอผลของงานก่อนกำหนด cover; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const cover = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    });
    return await appendAttachments(cover, draft);
  } finally {
    /* finally ปิด browser ทั้งเมื่อสำเร็จและเมื่อ throw เพื่อไม่ให้ process Chromium ค้างสะสม */
    await browser.close();
  }
}
