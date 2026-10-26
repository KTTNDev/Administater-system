"use client";
/**
 * แผนที่อ่านโค้ด — src/components/template-reference.tsx
 * หน้าที่: เปิด PDF แบบอ้างอิงเอกสารสำหรับตรวจเทียบรูปแบบ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ./workspace.tsx
 * 3. ../lib/document.ts
 * 4. ../app/actions.ts
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./workspace.tsx
 * อ่านต่อจาก import: ./pdf-preview.tsx
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useState } from "react";
/* นำเข้า ./pdf-preview.tsx — แสดง PDF ที่มีอยู่ด้วย PDF.js บน canvas ไม่ใช่ตัวสร้าง PDF ของหนังสือ */
import { PdfPreview } from "./pdf-preview";
const entries = [
  ["หนังสือภายนอก", 4],
  ["หนังสือภายใน", 7],
  ["บันทึก", 10],
  ["ประทับตรา — ย่อหน้าเดียว", 13],
  ["ประทับตรา — หลายย่อหน้า", 14],
  ["คำสั่ง — ผู้มีอำนาจลงนาม", 17],
  ["คำสั่ง — รับคำสั่ง", 18],
  ["ระเบียบ", 21],
  ["ประกาศ", 24],
  ["หนังสือรับรอง", 27],
  ["รายงานการประชุม", 30],
  ["ตัวอย่างบันทึกท้ายเอกสาร", 40],
] as const;
/* TemplateReference: เปิด PDF แบบอ้างอิงเอกสารสำหรับตรวจเทียบรูปแบบ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function TemplateReference() {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(4);
  return (
    <section className="panel" style={{ padding: 20, marginBottom: 24 }}>
      <button type="button" onClick={() => setOpen(!open)}>
        {open ? "ปิด" : "เปิด"}คู่มือแบบหนังสือเพิ่มเติม 40 หน้า
      </button>
      {open && (
        <>
          <p>
            คู่มือหลักหน้า 1–32 ระบุใช้ใน ทร. ส่วนท้ายเป็นเอกสารประกอบ
            แนวทางระยะบนมีทั้ง 2.5 ซม. และ 1.5 ซม. ต้องเลือกให้เหมาะกับหน่วยงาน
          </p>
          <label>
            เลือกแบบในคู่มือ
            <select
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
            >
              {entries.map(([label, p]) => (
                <option key={p} value={p}>
                  {label} — หน้า {p}
                </option>
              ))}
            </select>
          </label>
          <p>
            ระบบมีแบบหลักเหล่านี้อยู่แล้ว เลือกเริ่มร่างจากรายการด้านล่างได้
            ตัวเลือกขอบบนและรับคำสั่งอยู่ในส่วนรูปแบบของฟอร์ม
          </p>
          <div style={{ maxWidth: 720, margin: "auto" }}>
            <PdfPreview
              url="/api/template-reference"
              title="คู่มือแบบหนังสือเพิ่มเติม"
              pageNumber={page}
            />
          </div>
        </>
      )}
    </section>
  );
}
