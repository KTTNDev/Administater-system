"use client";
/**
 * แผนที่อ่านโค้ด — src/components/minutes-details.tsx
 * หน้าที่: ตัวเลือกแม่แบบประชุม ตารางกรรมการ รายละเอียด TOR และผู้ลงนามท้ายรายงาน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ../lib/minutes-presets.ts
 * 3. ./minutes-details.tsx ← คุณอยู่ที่นี่
 * 4. ./minutes-editor.tsx
 * 5. ./minutes-speeches-editor.tsx
 * 6. ./workspace.tsx
 * 7. ../app/actions.ts
 * 8. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./minutes-editor.tsx, ./workspace.tsx
 * อ่านต่อจาก import: ../lib/document.ts, ../lib/minutes-presets.ts, ./body-editor.tsx
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useState } from "react";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "@/lib/document";
/* นำเข้า ../lib/minutes-presets.ts — แม่แบบประชุมทั่วไป / TOR งานซื้อ / TOR งานจ้าง สร้างเฉพาะโครง ไม่สมมติราคา สเปก หรือมติให้ผู้ใช้ */
import {
  minutesPresets,
  minutesPresetPatch,
  type MinutesPresetId,
} from "@/lib/minutes-presets";
/* นำเข้า ./body-editor.tsx — textarea พร้อมเครื่องมือใส่ **ตัวหนา** และตารางข้อความ; ตัวแสดงเอกสารเป็นผู้แปลสัญลักษณ์เหล่านี้ */
import { BodyEditor } from "./body-editor";
/* ชนิด Props: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Props = { draft: Draft; onChange: (patch: Partial<Draft>) => void };
const moved = <T,>(items: T[], index: number, offset: number) => {
  const next = [...items],
    to = index + offset;
  if (to < 0 || to >= items.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
};
/* รวมปุ่มเลื่อนและลบที่ใช้ซ้ำ; disabled กันออกนอกขอบ array ส่วนการตัดสินใจลบอยู่ใน callback ของผู้เรียก */
function RowActions({
  index,
  length,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  length: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="agenda-actions">
      {/* ปุ่มเรียก () => onMove(-1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === 0; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
      <button
        type="button"
        className="secondary"
        aria-label={`เลื่อน${label} ${index + 1} ขึ้น`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={16} />
      </button>
      {/* ปุ่มเรียก () => onMove(1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === length - 1; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
      <button
        type="button"
        className="secondary"
        aria-label={`เลื่อน${label} ${index + 1} ลง`}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={16} />
      </button>
      {/* ปุ่มเรียก onRemove เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
      <button
        type="button"
        className="secondary"
        aria-label={`ลบ${label} ${index + 1}`}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
/* เลือกแม่แบบและยืนยันการแทนที่วาระก่อนขอ patch จาก minutes-presets.ts */
export function MinutesPresetPicker({ draft, onChange }: Props) {
  /* state [selected, setSelected], [message, setMessage]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [selected, setSelected] = useState<MinutesPresetId>(
      draft.minutesPreset,
    ),
    [message, setMessage] = useState("");
  const apply = (mode: "append" | "replace") => {
    if (
      mode === "replace" &&
      draft.meetingAgenda.length &&
      !confirm(
        "แทนที่วาระเดิมทั้งหมดด้วยแม่แบบที่เลือก? ข้ออภิปรายและมติในวาระเดิมจะถูกแทนที่ แต่รายชื่อและรายละเอียด TOR ที่กรอกไว้จะยังอยู่",
      )
    )
      return;
    /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
    try {
      /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
      onChange(minutesPresetPatch(draft, selected, mode));
      setMessage(
        "เพิ่มแม่แบบแล้ว แก้หัวข้อ รายชื่อ รายละเอียด และมติให้ตรงกับการประชุมจริงได้",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "เพิ่มแม่แบบไม่สำเร็จ");
    }
  };
  return (
    <div className="wide minutes-preset">
      <label>
        แม่แบบรายงานการประชุม
        {/* value อ่านจาก selected; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as MinutesPresetId)}
        >
          {minutesPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="field-note">
        {minutesPresets.find((p) => p.id === selected)?.description} ·
        ข้อความอิสระเดิมยังเก็บไว้เมื่อเปลี่ยนเป็นโหมดวาระ
      </p>
      <div className="minutes-controls">
        {/* ปุ่มเรียก () => apply("append") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
        <button
          type="button"
          className="secondary"
          onClick={() => apply("append")}
        >
          <Plus size={16} />
          {draft.meetingAgenda.length
            ? "เพิ่มแม่แบบต่อท้ายวาระเดิม"
            : "ใช้แม่แบบนี้"}
        </button>
        {draft.meetingAgenda.length > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={() => apply("replace")}
          >
            แทนที่วาระเดิม
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="field-note">
          {message}
        </p>
      )}
      <label>
        หัวรายงาน (เว้นว่างเพื่อใช้แบบเดิม)
        {/* value อ่านจาก draft.minutesTitle; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
        <input
          maxLength={300}
          value={draft.minutesTitle}
          onChange={(e) => onChange({ minutesTitle: e.target.value })}
          placeholder="รายงานการประชุมคณะกรรมการจัดทำร่างขอบเขตของงาน (TOR)"
        />
      </label>
    </div>
  );
}
/* แก้ตารางรายชื่อพร้อมสถานะ present/absent/participant; ฟอร์มนี้ไม่ได้สร้างการลงลายมือชื่อจริง */
export function MinutesMembersEditor({ draft, onChange }: Props) {
  /* ส่วน edit ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  const edit = (
    index: number,
    patch: Partial<Draft["meetingMembers"][number]>,
  ) =>
    onChange({
      meetingMembers: draft.meetingMembers.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    });
  return (
    <div className="wide minutes-members">
      <label>
        รูปแบบรายชื่อผู้ประชุม
        {/* value อ่านจาก draft.minutesAttendanceMode; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
        <select
          value={draft.minutesAttendanceMode}
          onChange={(e) =>
            onChange({
              minutesAttendanceMode: e.target
                .value as Draft["minutesAttendanceMode"],
            })
          }
        >
          <option value="text">ข้อความแบบเดิม</option>
          <option value="table">ตารางรายชื่อ พร้อมช่องลงลายมือชื่อ</option>
        </select>
      </label>
      {draft.minutesAttendanceMode === "table" && (
        <>
          <p className="field-note">
            ระบุชื่อ ตำแหน่ง และหน้าที่ตามคำสั่งแต่งตั้ง เลือกสถานะมาประชุม /
            ไม่มา / ผู้เข้าร่วมอื่นได้ ช่องลายมือชื่อเว้นไว้สำหรับลงนาม
          </p>
          {draft.meetingMembers.map((m, i) => (
            <section
              className="agenda-card"
              key={i}
              aria-label={`ผู้ประชุมคนที่ ${i + 1}`}
            >
              <div className="section-title">
                <strong>รายชื่อที่ {i + 1}</strong>
                <RowActions
                  index={i}
                  length={draft.meetingMembers.length}
                  label="ผู้ประชุม"
                  onMove={(offset) =>
                    onChange({
                      meetingMembers: moved(draft.meetingMembers, i, offset),
                    })
                  }
                  onRemove={() => {
                    if (confirm("ลบรายชื่อนี้ออกจากการประชุม?"))
                      /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
                      onChange({
                        meetingMembers: draft.meetingMembers.filter(
                          (_, n) => n !== i,
                        ),
                      });
                  }}
                />
              </div>
              <div className="minutes-fields">
                <label>
                  ชื่อ–นามสกุล
                  {/* value อ่านจาก m.name; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                  <input
                    maxLength={300}
                    value={m.name}
                    onChange={(e) => edit(i, { name: e.target.value })}
                  />
                </label>
                <label>
                  ตำแหน่งราชการ
                  {/* value อ่านจาก m.position; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                  <input
                    maxLength={500}
                    value={m.position}
                    onChange={(e) => edit(i, { position: e.target.value })}
                  />
                </label>
                <label>
                  หน้าที่ในคณะกรรมการ
                  {/* value อ่านจาก m.role; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                  <input
                    list="minutes-roles"
                    maxLength={200}
                    value={m.role}
                    onChange={(e) => edit(i, { role: e.target.value })}
                  />
                </label>
                <label>
                  สถานะการเข้าประชุม
                  {/* value อ่านจาก m.status; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                  <select
                    value={m.status}
                    onChange={(e) =>
                      edit(i, { status: e.target.value as typeof m.status })
                    }
                  >
                    <option value="present">มาประชุม</option>
                    <option value="absent">ไม่มาประชุม</option>
                    <option value="participant">ผู้เข้าร่วมประชุมอื่น</option>
                  </select>
                </label>
              </div>
              <label>
                หมายเหตุ / เหตุผลที่ไม่มา
                {/* value อ่านจาก m.note; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <input
                  maxLength={1000}
                  value={m.note}
                  onChange={(e) => edit(i, { note: e.target.value })}
                />
              </label>
            </section>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={draft.meetingMembers.length >= 60}
            onClick={() =>
              onChange({
                meetingMembers: [
                  ...draft.meetingMembers,
                  {
                    name: "",
                    position: "",
                    role: "กรรมการ",
                    status: "present",
                    note: "",
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            เพิ่มผู้ประชุม
          </button>
          <datalist id="minutes-roles">
            {[
              "ประธานกรรมการ",
              "กรรมการ",
              "กรรมการและเลขานุการ",
              "ผู้ช่วยเลขานุการ",
              "ผู้เข้าร่วมประชุม",
            ].map((role) => (
              <option key={role} value={role} />
            ))}
          </datalist>
        </>
      )}
    </div>
  );
}
/* เลือกผู้จดและกรรมการลงนาม; ชื่อ ตำแหน่ง และบทบาทแยกกันเพื่อให้แก้กรณีรักษาการได้ */
export function MinutesSigningEditor({ draft, onChange }: Props) {
  /* ส่วน edit ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  const edit = (
    index: number,
    patch: Partial<Draft["meetingSigners"][number]>,
  ) =>
    onChange({
      meetingSigners: draft.meetingSigners.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    });
  return (
    <div className="wide minutes-signing">
      {draft.meetingMembers.length > 0 && (
        <label>
          เลือกผู้จดจากรายชื่อผู้ประชุม
          {/* value อ่านจาก ""; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value === "") return;
              const m = draft.meetingMembers[Number(e.target.value)];
              if (m)
                /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
                onChange({
                  recorder: m.name,
                  recorderPosition: m.position,
                  recorderRole: m.role
                    ? m.role + " / ผู้จดรายงานการประชุม"
                    : "ผู้จดรายงานการประชุม",
                });
            }}
          >
            <option value="">
              เลือกเพื่อกรอกชื่อและตำแหน่ง หรือพิมพ์เองด้านบน
            </option>
            {draft.meetingMembers.map((m, i) => (
              <option
                key={i}
                value={i}
                disabled={!m.name.trim() || m.status === "absent"}
              >
                {m.name || `รายชื่อ ${i + 1} (ยังไม่ระบุชื่อ)`}
              </option>
            ))}
          </select>
        </label>
      )}
      <details
        open={
          draft.minutesAttendanceMode === "table" ||
          draft.meetingSigners.length > 0
        }
      >
        <summary>ตำแหน่งผู้จดและผู้ลงนามท้ายรายงาน</summary>
        <div className="minutes-fields">
          <label>
            ตำแหน่งผู้จดรายงาน
            {/* value อ่านจาก draft.recorderPosition; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
            <input
              maxLength={500}
              value={draft.recorderPosition}
              onChange={(e) => onChange({ recorderPosition: e.target.value })}
            />
          </label>
          <label>
            บทบาทที่แสดงใต้ชื่อผู้จด
            {/* value อ่านจาก draft.recorderRole; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
            <input
              maxLength={200}
              value={draft.recorderRole}
              onChange={(e) => onChange({ recorderRole: e.target.value })}
            />
          </label>
        </div>
        {draft.meetingSigners.map((m, i) => (
          <section
            className="agenda-card"
            key={i}
            aria-label={`ผู้ลงนามเพิ่มเติม ${i + 1}`}
          >
            <div className="section-title">
              <strong>ผู้ลงนามเพิ่มเติม {i + 1}</strong>
              <RowActions
                index={i}
                length={draft.meetingSigners.length}
                label="ผู้ลงนามประชุม"
                onMove={(offset) =>
                  onChange({
                    meetingSigners: moved(draft.meetingSigners, i, offset),
                  })
                }
                onRemove={() =>
                  onChange({
                    meetingSigners: draft.meetingSigners.filter(
                      (_, n) => n !== i,
                    ),
                  })
                }
              />
            </div>
            <label>
              ชื่อผู้ลงนาม
              {/* value อ่านจาก m.name; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
              <input
                maxLength={300}
                value={m.name}
                onChange={(e) => edit(i, { name: e.target.value })}
              />
            </label>
            <div className="minutes-fields">
              <label>
                ตำแหน่งผู้ลงนาม
                {/* value อ่านจาก m.position; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <input
                  maxLength={500}
                  value={m.position}
                  onChange={(e) => edit(i, { position: e.target.value })}
                />
              </label>
              <label>
                บทบาทผู้ลงนาม
                {/* value อ่านจาก m.role; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <input
                  maxLength={200}
                  value={m.role}
                  onChange={(e) => edit(i, { role: e.target.value })}
                />
              </label>
            </div>
          </section>
        ))}
        <div className="minutes-controls">
          <button
            type="button"
            className="secondary"
            disabled={draft.meetingSigners.length >= 20}
            onClick={() =>
              onChange({
                meetingSigners: [
                  ...draft.meetingSigners,
                  { name: "", position: "", role: "กรรมการ" },
                ],
              })
            }
          >
            <Plus size={16} />
            เพิ่มผู้ลงนามท้ายรายงาน
          </button>
          {draft.meetingMembers.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                /* ส่วน existing ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
                const existing = new Set([
                  draft.recorder.trim(),
                  ...draft.meetingSigners.map((s) => s.name.trim()),
                ]);
                /* ส่วน added ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
                const added = draft.meetingMembers
                  .filter(
                    (m) =>
                      m.status === "present" &&
                      m.name.trim() &&
                      !existing.has(m.name.trim()),
                  )
                  .map(({ name, position, role }) => ({
                    name,
                    position,
                    role,
                  }));
                if (draft.meetingSigners.length + added.length > 20) {
                  alert("ผู้ลงนามรวมต้องไม่เกิน 20 คน");
                  return;
                }
                /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
                onChange({
                  meetingSigners: [...draft.meetingSigners, ...added],
                });
              }}
            >
              เพิ่มจากกรรมการที่มาประชุม
            </button>
          )}
        </div>
        <p className="field-note">
          ชื่อผู้จดมีช่องลงนามของตนเองแล้ว ผู้ลงนามเพิ่มเติมจะแสดงตามลำดับนี้
          สามารถแก้บทบาทหรือตำแหน่งรักษาการได้
        </p>
      </details>
    </div>
  );
}
/* แก้ metadata คำสั่ง/งบและรายการหัวข้อ TOR; spread ซ้อนกันเพื่อคงค่าหัวข้ออื่นที่ไม่ได้แก้ */
export function TorDetailsEditor({ draft, onChange }: Props) {
  const tor = draft.minutesTor,
    patch = (value: Partial<typeof tor>) =>
      onChange({ minutesTor: { ...tor, ...value } });
  /* ส่วน edit ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  const edit = (i: number, value: Partial<(typeof tor.sections)[number]>) =>
    patch({
      sections: tor.sections.map((s, n) => (n === i ? { ...s, ...value } : s)),
    });
  return (
    <div className="wide tor-details">
      <h4>ข้อมูลประกอบการพิจารณา TOR</h4>
      <div className="minutes-fields">
        <label>
          คำสั่งแต่งตั้งเลขที่
          {/* value อ่านจาก tor.appointmentNumber; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
          <input
            maxLength={200}
            value={tor.appointmentNumber}
            onChange={(e) => patch({ appointmentNumber: e.target.value })}
          />
        </label>
        <label>
          วันที่คำสั่งแต่งตั้ง
          {/* value อ่านจาก tor.appointmentDate; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
          <input
            type="date"
            value={tor.appointmentDate}
            onChange={(e) => patch({ appointmentDate: e.target.value })}
          />
        </label>
        <label>
          ผู้แต่งตั้ง / หน่วยงาน
          {/* value อ่านจาก tor.authority; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
          <input
            maxLength={500}
            value={tor.authority}
            onChange={(e) => patch({ authority: e.target.value })}
          />
        </label>
        <label>
          วงเงินงบประมาณและแหล่งงบ
          {/* value อ่านจาก tor.budget; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
          <input
            maxLength={500}
            value={tor.budget}
            onChange={(e) => patch({ budget: e.target.value })}
            placeholder="ระบุจำนวนเงิน หน่วย และปีงบประมาณตามหลักฐาน"
          />
        </label>
      </div>
      <label>
        แหล่งอ้างอิงราคา / มาตรฐาน
        {/* value อ่านจาก tor.priceReference; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
        <textarea
          rows={2}
          maxLength={2000}
          value={tor.priceReference}
          onChange={(e) => patch({ priceReference: e.target.value })}
        />
      </label>
      <p className="field-note">
        แม่แบบให้เฉพาะหัวข้อ ไม่เติมผลอนุมัติ ราคา สเปก หรือเงื่อนไขสัญญาให้เอง
        ตรวจตามงานจริงและลบหัวข้อที่ไม่ใช้ได้
      </p>
      {tor.sections.map((s, i) => (
        <details className="agenda-card" key={i} open={i === 0}>
          <summary>
            {i + 1}. {s.title || "หัวข้อ TOR ใหม่"}
            {s.body.trim() ? " · มีรายละเอียดแล้ว" : ""}
          </summary>
          <div className="section-title">
            <strong>หัวข้อ TOR {i + 1}</strong>
            <RowActions
              index={i}
              length={tor.sections.length}
              label="หัวข้อ TOR"
              onMove={(offset) =>
                patch({ sections: moved(tor.sections, i, offset) })
              }
              onRemove={() => {
                if (confirm("ลบหัวข้อ TOR และรายละเอียดนี้?"))
                  patch({ sections: tor.sections.filter((_, n) => n !== i) });
              }}
            />
          </div>
          <label>
            ชื่อหัวข้อ TOR
            {/* value อ่านจาก s.title; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
            <input
              maxLength={300}
              value={s.title}
              onChange={(e) => edit(i, { title: e.target.value })}
            />
          </label>
          <label htmlFor={`tor-body-${i}`}>รายละเอียด TOR {i + 1}</label>
          {/* จุดเชื่อม component BodyEditor: props ส่งข้อมูลลง ส่วน onChange ส่งค่ากลับ; อ่านต่อที่ ./body-editor.tsx ใน export ชื่อนี้ */}
          <BodyEditor
            id={`tor-body-${i}`}
            rows={6}
            value={s.body}
            onChange={(body) => edit(i, { body })}
          />
        </details>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={tor.sections.length >= 30}
        onClick={() =>
          patch({ sections: [...tor.sections, { title: "", body: "" }] })
        }
      >
        <Plus size={16} />
        เพิ่มหัวข้อ TOR
      </button>
    </div>
  );
}
