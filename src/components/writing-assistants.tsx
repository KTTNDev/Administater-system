"use client";
/**
 * แผนที่อ่านโค้ด — src/components/writing-assistants.tsx
 * หน้าที่: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง
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
 * ผู้ใช้ไฟล์นี้โดยตรง: ./document-tools.tsx, ./workspace.tsx
 * อ่านต่อจาก import: ../app/legal-actions.ts, ../lib/document.ts, ../lib/conclusions.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useState } from "react";
/* นำเข้า ../app/legal-actions.ts — CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ */
import { listLegalReferences } from "@/app/legal-actions";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { type Draft } from "@/lib/document";
/* นำเข้า ../lib/conclusions.ts — คลังข้อความลงท้ายให้เลือกใช้ ไม่ใช่ผลการพิจารณาที่ระบบอนุมัติแทนผู้ใช้ */
import { conclusionPhrases, conclusionSources } from "@/lib/conclusions";
/* ชนิด Props: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Props = { draft: Draft; onChange: (patch: Partial<Draft>) => void };
/* ชนิด Reference: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Reference = Awaited<ReturnType<typeof listLegalReferences>>[number];
/* openReference: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function openReference(item: Reference) {
  window.dispatchEvent(new CustomEvent("sarabun-law-reader", { detail: item }));
}
/* LegalPicker: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function LegalPicker({ draft: d, onChange: change }: Props) {
  const [items, setItems] = useState<Reference[]>([]),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  /* refresh: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function refresh() {
    listLegalReferences()
      .then(setItems)
      .catch(() => setError("โหลดคลังไม่สำเร็จ กรุณาลองอีกครั้ง"));
  }
  useEffect(() => {
    refresh();
    window.addEventListener("sarabun-library-updated", refresh);
    return () => window.removeEventListener("sarabun-library-updated", refresh);
  }, []);
  const filtered = items.filter((x) =>
    `${x.title} ${x.section} ${x.notes} ${x.tags} ${x.highlight} ${x.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const item = items.find((x) => x.id === selected);
  return (
    <div className="inline-assistant">
      <strong>ค้นกฎหมายประกอบย่อหน้านี้</strong>
      <label>
        ค้นชื่อกฎหมาย / มาตราในคลัง
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="เช่น งานสารบรรณ หรือ ข้อ 12"
        />
      </label>
      <label>
        เลือกกฎหมายที่เกี่ยวข้อง
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">เลือกจาก {filtered.length} รายการ</option>
          {filtered.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title} {x.section}
            </option>
          ))}
        </select>
      </label>
      {item && (
        <>
          <small>
            {item.section} •{" "}
            {item.fileName ? "มีไฟล์ PDF" : "ลิงก์ / บันทึกอ้างอิง"}
          </small>
          <div className="stamp-buttons">
            <button type="button" onClick={() => openReference(item)}>
              เปิดอ่านข้างร่าง
            </button>
            <button
              type="button"
              onClick={() =>
                change({
                  legalBasis: [
                    d.legalBasis,
                    [item.title, item.section].filter(Boolean).join(" "),
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  legalReferenceIds: Array.from(
                    new Set([...d.legalReferenceIds, item.id]),
                  ),
                })
              }
            >
              แทรกชื่อและมาตรา
            </button>
            <button
              type="button"
              onClick={() =>
                change({
                  legalReferenceIds: Array.from(
                    new Set([...d.legalReferenceIds, item.id]),
                  ),
                })
              }
            >
              {d.legalReferenceIds.includes(item.id)
                ? "เชื่อมโยงแล้ว"
                : "เชื่อมโยงกับร่าง"}
            </button>
          </div>
        </>
      )}
      <p className="field-note">
        เพิ่มลิงก์หรือไฟล์จริงที่ “คลังกฎหมายและเอกสารอ้างอิง” ด้านล่าง
        ค้นจากชื่อ มาตรา และบันทึก ยังไม่ค้นข้อความภายใน PDF
      </p>
      <div className="stamp-buttons">
        <button type="button" onClick={refresh}>
          รีเฟรชคลัง
        </button>
        <a href="https://www.krisdika.go.th/" target="_blank" rel="noreferrer">
          สำนักงานคณะกรรมการกฤษฎีกา
        </a>
        <a
          href="https://ratchakitcha.soc.go.th/"
          target="_blank"
          rel="noreferrer"
        >
          ราชกิจจานุเบกษา
        </a>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
/* ConclusionPicker: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function ConclusionPicker({ draft: d, onChange: change }: Props) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState("");
  const rows = conclusionPhrases.filter((x) =>
    (x.text + x.group).includes(query),
  );
  /* insert: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function insert(replace: boolean) {
    if (!selected) return;
    const key = d.bodyMode === "structured" ? "proposal" : "body";
    if (
      replace &&
      d[key] &&
      !confirm("แทนที่ข้อความในช่องบทสรุปทั้งหมดด้วยประโยคที่เลือกหรือไม่?")
    )
      return;
    change({
      [key]: replace ? selected : [d[key], selected].filter(Boolean).join("\n"),
    });
  }
  return (
    <div className="inline-assistant">
      <strong>แนวทางประโยคสรุป</strong>
      <label>
        ค้นประโยคสรุป
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ทราบ / อนุมัติ / อนุญาต / ลงนาม"
        />
      </label>
      <label>
        เลือกประโยคตามวัตถุประสงค์
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">เลือกประโยค ({rows.length} รายการ)</option>
          {Array.from(new Set(rows.map((x) => x.group))).map((group) => (
            <optgroup key={group} label={group}>
              {rows
                .filter((x) => x.group === group)
                .map((x) => (
                  <option key={x.text} value={x.text}>
                    {x.text}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="stamp-buttons">
        <button
          type="button"
          disabled={!selected}
          onClick={() => insert(false)}
        >
          เพิ่มเป็นย่อหน้าสุดท้าย
        </button>
        {d.bodyMode === "structured" && (
          <button
            type="button"
            disabled={!selected}
            onClick={() => insert(true)}
          >
            ใช้แทนข้อความบทสรุป
          </button>
        )}
      </div>
      <p className="field-note">
        แนวทาง {conclusionPhrases.length}{" "}
        ประโยคที่ระบบรวบรวมและปรับตามวัตถุประสงค์
        ไม่ใช่บัญชีคำบังคับทั้งหมดในระเบียบ เลือกแล้วแก้ถ้อยคำได้ และปรับ
        “เรียน” ให้ตรงคำขึ้นต้นเมื่อจำเป็น
      </p>
      {conclusionSources.map((s) => (
        <a
          className="text-link"
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
        >
          {s.title}
        </a>
      ))}
    </div>
  );
}
/* LegalReader: ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function LegalReader() {
  const [item, setItem] = useState<Reference | null>(null);
  useEffect(() => {
    const listener = (e: Event) =>
      setItem((e as CustomEvent<Reference>).detail);
    window.addEventListener("sarabun-law-reader", listener);
    return () => window.removeEventListener("sarabun-law-reader", listener);
  }, []);
  if (!item) return null;
  const url = item.fileName ? `/api/legal/${item.id}?inline=1` : item.url;
  return (
    <aside className="law-reader" aria-label="อ่านกฎหมายควบคู่ร่าง">
      <header>
        <strong>เอกสารอ้างอิง</strong>
        <button
          type="button"
          className="secondary"
          onClick={() => setItem(null)}
        >
          กลับตัวอย่าง A4
        </button>
      </header>
      <div className="law-reader-info">
        <h3>{item.title}</h3>
        <p>{item.section}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{item.notes}</p>
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            เปิดต้นฉบับในแท็บใหม่ ↗
          </a>
        )}
        <small>
          พิมพ์ร่างทางซ้ายต่อได้ หากเว็บต้นทางไม่อนุญาตให้ฝัง ให้เปิดในแท็บใหม่
        </small>
      </div>
      {url ? (
        <iframe
          title={`อ่าน ${item.title}`}
          src={url}
          referrerPolicy="no-referrer"
        />
      ) : (
        <p>รายการนี้มีเฉพาะบันทึก เพิ่มไฟล์หรือลิงก์ในคลังเพื่ออ่านต้นฉบับ</p>
      )}
    </aside>
  );
}
