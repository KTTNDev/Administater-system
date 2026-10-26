"use client";
/**
 * แผนที่อ่านโค้ด — src/components/minutes-speeches-editor.tsx
 * หน้าที่: ฟอร์มผู้พูดหลายรายการในวาระเดียว ส่งรายการใหม่กลับให้ parent โดยไม่บันทึกฐานข้อมูลเอง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ../lib/minutes-presets.ts
 * 3. ./minutes-details.tsx
 * 4. ./minutes-editor.tsx
 * 5. ./minutes-speeches-editor.tsx ← คุณอยู่ที่นี่
 * 6. ./workspace.tsx
 * 7. ../app/actions.ts
 * 8. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./minutes-editor.tsx
 * อ่านต่อจาก import: ../lib/document.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "@/lib/document";

/* ชนิด Speeches: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; NonNullable ตัด null/undefined ออก และ [number] เลือกชนิดสมาชิกหนึ่งตัวของ array */
/* อ่านจากซ้ายไปขวา: Draft → meetingAgenda (array) → [number] (หนึ่งวาระ) → speeches (array ที่อาจ undefined) → NonNullable เอา undefined ออก */
type Speeches = NonNullable<Draft["meetingAgenda"][number]["speeches"]>;
/* อ่าน speeches ของวาระเดียวและส่ง array ใหม่ให้ MinutesEditor; คนเดียวกันมีหลายรายการตามลำดับการพูดได้ */
export function MinutesSpeechesEditor({
  speeches = [],
  agendaNumber,
  onChange,
}: {
  speeches?: Speeches;
  agendaNumber: number;
  onChange: (speeches: Speeches) => void;
}) {
  /* ส่วน edit ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  /* Partial<Speeches[number]> หมายถึงบางช่องของผู้พูดหนึ่งรายการ; เช่น {speaker: "..."} เปลี่ยนชื่ออย่างเดียว โดย {...speech,...patch} รักษาบทบาทและข้อความเดิม */
  const edit = (index: number, patch: Partial<Speeches[number]>) =>
    onChange(
      speeches.map((speech, i) =>
        i === index ? { ...speech, ...patch } : speech,
      ),
    );
  /* คัดลอก array แล้วสลับตำแหน่ง หลีกเลี่ยงการแก้ props เดิมโดยตรง */
  const move = (index: number, offset: number) => {
    /* ... ใน array คือ shallow copy: เราจะสลับตำแหน่งสมาชิก ไม่แก้ props array ที่ parent ส่งเข้ามา */
    const next = [...speeches],
      to = index + offset;
    /* ตรวจขอบก่อนสลับ index; เงื่อนไขปุ่ม disabled ช่วย UX แต่ฟังก์ชันต้องป้องกันเองด้วย */
    if (to < 0 || to >= next.length) return;
    /* destructuring assignment สลับสองสมาชิกโดยไม่ต้องใช้ตัวแปรพัก */
    [next[index], next[to]] = [next[to], next[index]];
    /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
    onChange(next);
  };
  /* เพิ่มรายการว่างลง array ใหม่แล้วส่ง onChange กลับ parent; ขีดจำกัดต้องตรง schema */
  /* หากจะเพิ่มจำนวนเกิน 50: แก้ทั้ง if นี้, disabled/ข้อความใน JSX ด้านล่าง และ .max(50) ของ speeches ใน ../lib/document.ts; แล้วเพิ่มเคส tests/e2e/tor-minutes.spec.ts */
  const add = () => {
    if (speeches.length < 50)
      /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
      onChange([...speeches, { speaker: "", role: "", text: "" }]);
  };
  /* JSX ด้านล่างอธิบายหน้าจอ: value ทำ input ให้สะท้อน props, onChange ส่งค่ากลับ edit → MinutesEditor → Workspace; ฐานข้อมูลจะเปลี่ยนเมื่อกดบันทึกเท่านั้น */
  return (
    <section
      className="minutes-speeches"
      aria-label={`ผู้พูดในวาระที่ ${agendaNumber}`}
    >
      <div className="section-title">
        <strong>ผู้พูดและข้อซักถาม · {speeches.length} รายการ</strong>
        {/* ปุ่มเรียก add เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข speeches.length >= 50; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
        <button
          type="button"
          className="secondary"
          disabled={speeches.length >= 50}
          onClick={add}
        >
          <Plus size={16} />
          เพิ่มผู้พูด / ข้อซักถาม
        </button>
      </div>
      <p className="field-note">
        เพิ่มได้หลายคนในวาระเดียว เรียงตามลำดับการพูด
        หากคนเดิมพูดอีกครั้งให้เพิ่มรายการใหม่ได้
      </p>
      {speeches.map((speech, index) => (
        <section
          className="agenda-card"
          key={index}
          aria-label={`ผู้พูดลำดับที่ ${index + 1}`}
        >
          <div className="section-title">
            <strong>ผู้พูดลำดับที่ {index + 1}</strong>
            <div className="agenda-actions">
              {/* ปุ่มเรียก () => move(index, -1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === 0; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
              <button
                type="button"
                className="secondary"
                aria-label={`เลื่อนผู้พูด ${index + 1} ขึ้น`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              {/* ปุ่มเรียก () => move(index, 1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === speeches.length - 1; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
              <button
                type="button"
                className="secondary"
                aria-label={`เลื่อนผู้พูด ${index + 1} ลง`}
                disabled={index === speeches.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`ลบผู้พูด ${index + 1}`}
                onClick={() => {
                  if (
                    (!speech.speaker.trim() &&
                      !speech.role.trim() &&
                      !speech.text.trim()) ||
                    confirm("ลบผู้พูดและข้อความรายการนี้?")
                  )
                    /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
                    onChange(speeches.filter((_, i) => i !== index));
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="minutes-fields">
            <label>
              ชื่อผู้พูด
              {/* value อ่านจาก speech.speaker; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
              <input
                maxLength={300}
                value={speech.speaker}
                onChange={(e) => edit(index, { speaker: e.target.value })}
              />
            </label>
            <label>
              บทบาทผู้พูด
              {/* value อ่านจาก speech.role; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
              <input
                maxLength={200}
                value={speech.role}
                onChange={(e) => edit(index, { role: e.target.value })}
              />
            </label>
          </div>
          <label htmlFor={`speech-${agendaNumber}-${index}`}>
            คำอภิปราย / ข้อซักถาม
          </label>
          {/* value อ่านจาก speech.text; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server; id เชื่อมกับ htmlFor ของ label เพื่อให้คลิกชื่อช่องและโปรแกรมอ่านจอทำงาน */}
          <textarea
            id={`speech-${agendaNumber}-${index}`}
            rows={3}
            maxLength={10000}
            value={speech.text}
            onChange={(e) => edit(index, { text: e.target.value })}
          />
        </section>
      ))}
      {speeches.length >= 50 && (
        <p role="status" className="field-note">
          วาระนี้ครบ 50 รายการแล้ว
        </p>
      )}
    </section>
  );
}
