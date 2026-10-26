"use client";
/**
 * แผนที่อ่านโค้ด — src/components/body-editor.tsx
 * หน้าที่: textarea พร้อมเครื่องมือใส่ **ตัวหนา** และตารางข้อความ; ตัวแสดงเอกสารเป็นผู้แปลสัญลักษณ์เหล่านี้
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
 * ผู้ใช้ไฟล์นี้โดยตรง: ./minutes-details.tsx, ./workspace.tsx
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useRef } from "react";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { Bold, Table2 } from "lucide-react";

/* เก็บข้อความเป็น string พร้อม markdown แบบจำกัด; textarea ref ใช้อ่านตำแหน่ง cursor เพื่อแทรกข้อความ */
export function BodyEditor({
  value,
  onChange,
  required = false,
  id,
  rows = 12,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  rows?: number;
}) {
  /* ref ref: อ้าง DOM/ค่าที่ต้องคงระหว่าง render; เปลี่ยน .current ไม่ทำให้ render ใหม่ */
  const ref = useRef<HTMLTextAreaElement>(null);
  /* อ่านช่วงที่เลือก แทรก ** รอบข้อความ แล้วคืน focus/selection หลัง React อัปเดต DOM */
  function wrapBold() {
    const input = ref.current;
    if (!input) return;
    const start = input.selectionStart,
      end = input.selectionEnd,
      selected = value.slice(start, end);
    const next =
      value.slice(0, start) +
      `**${selected || "ข้อความตัวหนา"}**` +
      value.slice(end);
    /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const a = start + 2,
        b = a + (selected || "ข้อความตัวหนา").length;
      input.setSelectionRange(a, b);
    });
  }
  /* แทรกตารางข้อความแบบ pipe ณ cursor; parser ใน render-document.ts จะเปลี่ยนเป็น table ในเอกสาร */
  function insertTable() {
    const input = ref.current;
    if (!input) return;
    const start = input.selectionStart,
      end = input.selectionEnd;
    const table = "| หัวข้อ | รายละเอียด |\n| --- | --- |\n|  |  |\n";
    const prefix = value.slice(0, start),
      separator = prefix && !prefix.endsWith("\n") ? "\n" : "";
    const next = prefix + separator + table + value.slice(end);
    /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = (
        prefix +
        separator +
        "| หัวข้อ | รายละเอียด |\n| --- | --- |\n| "
      ).length;
      input.setSelectionRange(cursor, cursor);
    });
  }
  return (
    <div className="body-editor">
      <div
        className="body-format-toolbar"
        role="toolbar"
        aria-label="จัดรูปแบบข้อความ"
      >
        {/* ปุ่มเรียก wrapBold เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
        <button
          type="button"
          className="secondary"
          onClick={wrapBold}
          title="ทำข้อความที่เลือกเป็นตัวหนา"
        >
          <Bold size={17} />
          ตัวหนา
        </button>
        {/* ปุ่มเรียก insertTable เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
        <button
          type="button"
          className="secondary"
          onClick={insertTable}
          title="แทรกตาราง 2 คอลัมน์"
        >
          <Table2 size={17} />
          แทรกตาราง
        </button>
        <span>เลือกข้อความแล้วกดตัวหนา · ตารางแก้ไขได้ในช่องข้อความ</span>
      </div>
      {/* value อ่านจาก value; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; id เชื่อมกับ htmlFor ของ label เพื่อให้คลิกชื่อช่องและโปรแกรมอ่านจอทำงาน */}
      <textarea
        id={id}
        ref={ref}
        required={required}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder="พิมพ์เนื้อหาหนังสือ… ใช้ **ข้อความ** เพื่อทำตัวหนา หรือกดแทรกตาราง"
      />
    </div>
  );
}
