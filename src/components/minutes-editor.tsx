"use client";
/**
 * แผนที่อ่านโค้ด — src/components/minutes-editor.tsx
 * หน้าที่: ฟอร์มวาระประชุม: เพิ่ม ลบ เรียงวาระ และเชื่อมรายละเอียด TOR กับผู้พูดแต่ละวาระ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ../lib/minutes-presets.ts
 * 3. ./minutes-details.tsx
 * 4. ./minutes-editor.tsx ← คุณอยู่ที่นี่
 * 5. ./minutes-speeches-editor.tsx
 * 6. ./workspace.tsx
 * 7. ../app/actions.ts
 * 8. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./workspace.tsx
 * อ่านต่อจาก import: ../lib/document.ts, ./minutes-details.tsx, ./minutes-speeches-editor.tsx
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { agendaProgress } from "@/lib/minutes-progress";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "@/lib/document";
/* นำเข้า ./minutes-details.tsx — ตัวเลือกแม่แบบประชุม ตารางกรรมการ รายละเอียด TOR และผู้ลงนามท้ายรายงาน */
import { TorDetailsEditor } from "./minutes-details";
/* นำเข้า ./minutes-speeches-editor.tsx — ฟอร์มผู้พูดหลายรายการในวาระเดียว ส่งรายการใหม่กลับให้ parent โดยไม่บันทึกฐานข้อมูลเอง */
import { MinutesSpeechesEditor } from "./minutes-speeches-editor";

const suggestions = [
  "เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ",
  "รับรองรายงานการประชุมครั้งที่ผ่านมา",
  "เรื่องสืบเนื่อง",
  "เรื่องเสนอเพื่อพิจารณา",
  "เรื่องอื่น ๆ",
];
/* controlled component: อ่าน draft จาก parent และส่ง Partial<Draft> กลับ ไม่เก็บร่างซ้ำใน state ของตัวเอง */
export function MinutesEditor({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // หมายเลขเป็นลำดับปัจจุบัน; สรุปคำนวณจาก draft สด จึงตามการเพิ่ม/ลบ/สลับทันที
  const progress = draft.meetingAgenda.map((agenda) => agendaProgress(agenda, draft.minutesTor.sections));
  const selected = Math.min(active, Math.max(0, draft.meetingAgenda.length - 1));
  useEffect(() => {
    const element = root.current;
    const context = element?.querySelector<HTMLElement>(".agenda-context-bar");
    if (!element || !context) return;
    const measure = () => element.style.setProperty("--agenda-context-height", `${context.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(context);
    measure();
    return () => observer.disconnect();
  }, [draft.minutesMode]);
  function jump(index: number) {
    setActive(index);
    const card = root.current?.querySelector<HTMLElement>(
      `[data-agenda-index="${index}"]`,
    );
    const pane = card?.closest<HTMLElement>(".form-pane");
    if (!card || !pane) return;
    const offset = (pane.querySelector<HTMLElement>(".form-jump-nav")?.offsetHeight || 0)
      + (root.current?.querySelector<HTMLElement>(".agenda-context-bar")?.offsetHeight || 0) + 8;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
    if (getComputedStyle(pane).overflowY === "auto")
      pane.scrollTo({
        top:
          pane.scrollTop +
          card.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          offset,
        behavior,
      });
    else
      window.scrollTo({
        top: window.scrollY + card.getBoundingClientRect().top - offset,
        behavior,
      });
  }
  /* ส่วน edit ใช้ map สร้าง array ใหม่จากแต่ละรายการ ไม่แก้ array เดิมโดยตรง */
  /* การแก้ผู้พูดส่งกลับเป็น {speeches: [...]} แล้ว map เลือกเฉพาะวาระ index นี้; จึงไม่ไปเปลี่ยนผู้พูดของวาระอื่น */
  const edit = (
    index: number,
    patch: Partial<Draft["meetingAgenda"][number]>,
  ) =>
    onChange({
      meetingAgenda: draft.meetingAgenda.map((a, i) =>
        i === index ? { ...a, ...patch } : a,
      ),
    });
  /* คัดลอก array แล้วสลับตำแหน่ง หลีกเลี่ยงการแก้ props เดิมโดยตรง */
  const move = (index: number, offset: number) => {
    const items = [...draft.meetingAgenda];
    if (index + offset < 0 || index + offset >= items.length) return;
    [items[index], items[index + offset]] = [
      items[index + offset],
      items[index],
    ];
    /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
    onChange({ meetingAgenda: items });
    setActive(index + offset);
  };
  return (
    <div className="wide minutes-editor" ref={root}>
      <label>
        รูปแบบเนื้อหารายงาน
        {/* value อ่านจาก draft.minutesMode; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
        <select
          value={draft.minutesMode}
          onChange={(e) =>
            onChange({ minutesMode: e.target.value as Draft["minutesMode"] })
          }
        >
          <option value="free">ข้อความอิสระ / ร่างเดิม</option>
          <option value="agenda">แยกวาระ ข้ออภิปราย และมติ</option>
        </select>
      </label>
      <p className="field-note">
        สลับรูปแบบได้โดยเก็บข้อความทั้งสองแบบไว้ เอกสารจะแสดงเฉพาะแบบที่เลือก
      </p>
      {draft.minutesMode === "agenda" && (
        <>
          <div className="agenda-overview">
            <div className="agenda-overview-title">
              <strong>{draft.meetingAgenda.length} วาระ</strong>
              <span>
                ครบช่องหลัก {progress.filter((p) => p.complete).length} วาระ
              </span>
            </div>
            <p className="field-note">
              เลือกวาระเพื่อไปกรอก · สถานะนี้ช่วยติดตามช่องกรอก
              ไม่ใช่ผลตรวจรับรอง
            </p>
            <nav aria-label="เลือกวาระการประชุม" className="agenda-jump-list">
              {draft.meetingAgenda.map((agenda, index) => (
                <button
                  type="button"
                  key={index}
                  aria-label={`ไปวาระที่ ${index + 1}`}
                  aria-current={selected === index ? "location" : undefined}
                  onClick={() => jump(index)}
                >
                  <span className="agenda-jump-number">{index + 1}</span>
                  <span className="agenda-jump-text">
                    <strong>{agenda.title || "ยังไม่ระบุหัวข้อ"}</strong>
                    <small>
                      ผู้พูด {progress[index].speakers} รายการ ·{" "}
                      {progress[index].complete
                        ? "ครบช่องหลัก"
                        : progress[index].started
                          ? "กำลังกรอก"
                          : "ยังไม่เริ่ม"}
                    </small>
                  </span>
                  <span
                    className={`agenda-state ${progress[index].complete ? "complete" : ""}`}
                  >
                    {progress[index].complete
                      ? "✓"
                      : progress[index].missing.length}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          <div className="agenda-context-bar">
            <label>
              กำลังทำวาระ
              <select
                aria-label="ไปยังวาระ"
                value={selected}
                onChange={(event) => jump(Number(event.target.value))}
                disabled={!draft.meetingAgenda.length}
              >
                {draft.meetingAgenda.map((agenda, index) => (
                  <option key={index} value={index}>
                    {index + 1}. {agenda.title || "ยังไม่ระบุหัวข้อ"}
                  </option>
                ))}
              </select>
            </label>
            <span>{draft.meetingAgenda.length} วาระ</span>
          </div>
          <label>
            ข้อความเปิดประชุม
            {/* value อ่านจาก draft.minutesIntroduction; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
            <textarea
              rows={3}
              maxLength={10000}
              value={draft.minutesIntroduction}
              onChange={(e) =>
                onChange({ minutesIntroduction: e.target.value })
              }
              placeholder="เช่น เมื่อผู้มาประชุมครบองค์ประชุม ประธานกล่าวเปิดประชุม…"
            />
          </label>
          <datalist id="meeting-agenda-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="field-note">
            หัวข้อแนะนำปรับได้ตามการประชุมจริง
            คู่มือไม่ได้กำหนดให้ทุกการประชุมต้องมีวาระเหมือนกัน
          </p>
          {draft.meetingAgenda.map((agenda, index) => (
            <section
              className={`agenda-card agenda-workspace${selected === index ? " agenda-active" : ""}`}
              key={index}
              aria-label={`วาระที่ ${index + 1}`}
              data-agenda-index={index}
              onFocusCapture={() => setActive(index)}
            >
              <div className="section-title agenda-sticky-heading">
                <div>
                  <strong>วาระที่ {index + 1}</strong>
                  <span className="agenda-heading-subject">
                    {agenda.title || "ยังไม่ระบุหัวข้อ"}
                  </span>
                  <small>ผู้พูด {progress[index].speakers} รายการ</small>
                </div>
                <div className="agenda-actions">
                  {/* ปุ่มเรียก () => move(index, -1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === 0; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`เลื่อนวาระ ${index + 1} ขึ้น`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  {/* ปุ่มเรียก () => move(index, 1) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข index === draft.meetingAgenda.length - 1; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`เลื่อนวาระ ${index + 1} ลง`}
                    disabled={index === draft.meetingAgenda.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`ลบวาระ ${index + 1}`}
                    onClick={() => {
                      if (
                        confirm(
                          `ลบวาระที่ ${index + 1} และข้อความในวาระนี้หรือไม่?`,
                        )
                      ) {
                        /* ส่งค่าใหม่ให้ parent ผ่าน callback; ตาม onChange ในไฟล์ผู้เรียกเพื่อดูว่าไปปรับ draft ช่องใด */
                        onChange({
                          meetingAgenda: draft.meetingAgenda.filter(
                            (_, i) => i !== index,
                          ),
                        });
                        setActive(Math.max(0, index - 1));
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="agenda-progress" role="status">
                <span>
                  {progress[index].complete
                    ? "✓ กรอกช่องหลักครบ"
                    : `ยังขาด: ${progress[index].missing.slice(0, 3).join(" · ")}${progress[index].missing.length > 3 ? ` และอีก ${progress[index].missing.length - 3} จุด` : ""}`}
                </span>
                <small>
                  {progress[index].resolution
                    ? "มีผลการพิจารณาแล้ว"
                    : "ยังไม่ระบุผลการพิจารณา (ถ้ามี)"}
                </small>
              </div>
              <label>
                หัวข้อวาระ
                {/* value อ่านจาก agenda.title; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <input
                  list="meeting-agenda-suggestions"
                  maxLength={300}
                  value={agenda.title}
                  onChange={(e) => edit(index, { title: e.target.value })}
                />
              </label>
              <label>
                ข้ออภิปราย / รายละเอียด
                {/* value อ่านจาก agenda.discussion; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <textarea
                  rows={5}
                  maxLength={10000}
                  value={agenda.discussion}
                  onChange={(e) => edit(index, { discussion: e.target.value })}
                  placeholder="ระบุผู้เสนอ ประเด็น และความคิดเห็นที่ต้องบันทึก"
                />
              </label>
              <label className="check-label">
                {/* checked ผูกสถานะช่องเลือกกับ !!agenda.torDetails; อ่าน e.target.checked เป็น boolean ใน onChange */}
                <input
                  type="checkbox"
                  checked={!!agenda.torDetails}
                  onChange={(e) =>
                    onChange({
                      meetingAgenda: draft.meetingAgenda.map((a, i) =>
                        i === index
                          ? { ...a, torDetails: e.target.checked }
                          : e.target.checked
                            ? { ...a, torDetails: false }
                            : a,
                      ),
                    })
                  }
                />
                แสดงชุดรายละเอียด TOR ในวาระนี้
              </label>
              {agenda.torDetails && (
                <TorDetailsEditor draft={draft} onChange={onChange} />
              )}
              {/* จุดเชื่อม component MinutesSpeechesEditor: props ส่งข้อมูลลง ส่วน onChange ส่งค่ากลับ; อ่านต่อที่ ./minutes-speeches-editor.tsx ใน export ชื่อนี้ */}
              <MinutesSpeechesEditor
                speeches={agenda.speeches}
                agendaNumber={index + 1}
                agendaTitle={agenda.title}
                onChange={(speeches) => edit(index, { speeches })}
              />
              <label>
                ชื่อหัวข้อผลการพิจารณา
                {/* value อ่านจาก agenda.resolutionLabel; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                <select
                  value={agenda.resolutionLabel}
                  onChange={(e) =>
                    edit(index, {
                      resolutionLabel: e.target
                        .value as typeof agenda.resolutionLabel,
                    })
                  }
                >
                  {["มติที่ประชุม", "ข้อยุติ", "ข้อสรุป"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                ผลการพิจารณา (ถ้ามี)
                {/* value อ่านจาก agenda.resolution; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent; maxLength เป็นข้อจำกัด UI ต้องสอดคล้องกับ schema ฝั่ง server */}
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={agenda.resolution}
                  onChange={(e) => edit(index, { resolution: e.target.value })}
                  placeholder="ไม่กรอก ระบบจะไม่แสดงหัวข้อนี้ในเอกสาร"
                />
              </label>
            </section>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={draft.meetingAgenda.length >= 50}
            onClick={() => {
              onChange({
                meetingAgenda: [
                  ...draft.meetingAgenda,
                  {
                    title: "",
                    discussion: "",
                    resolution: "",
                    resolutionLabel: "มติที่ประชุม",
                  },
                ],
              });
              requestAnimationFrame(() => jump(draft.meetingAgenda.length));
            }}
          >
            <Plus size={16} />
            เพิ่มวาระการประชุม
          </button>
        </>
      )}
    </div>
  );
}
