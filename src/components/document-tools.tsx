"use client";
/**
 * แผนที่อ่านโค้ด — src/components/document-tools.tsx
 * หน้าที่: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง
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
 * อ่านต่อจาก import: ../lib/document.ts, ../app/legal-actions.ts, ./writing-assistants.tsx
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useState, useTransition } from "react";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { type Draft, numerals } from "@/lib/document";
/* นำเข้า ../app/legal-actions.ts — CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ */
import {
  listLegalReferences,
  saveLegalReference,
  deleteLegalReference,
} from "@/app/legal-actions";
/* นำเข้า ./writing-assistants.tsx — ตัวช่วยเลือกกฎหมาย ข้อความสรุป และเปิดอ่านแหล่งอ้างอิงขณะร่าง */
import {
  LegalPicker,
  ConclusionPicker,
  openReference,
} from "./writing-assistants";
/* ชนิด Props: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Props = { draft: Draft; onChange: (patch: Partial<Draft>) => void };
/* DocumentTools: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function DocumentTools({ draft: d, onChange: change }: Props) {
  return (
    <details className="form-section" open>
      <summary>
        <strong>ตราข้อความและรูปแบบตัวเลข</strong>
      </summary>
      <div className="field-grid">
        <label className="wide">
          ระยะขอบบนหน้าแรก
          <select
            value={d.firstPageTop}
            onChange={(e) =>
              change({ firstPageTop: e.target.value as Draft["firstPageTop"] })
            }
          >
            <option value="15">1.5 ซม. — แนวทางเดิม</option>
            <option value="25">2.5 ซม. — เผื่อตรารับ ตามคู่มือเพิ่มเติม</option>
          </select>
        </label>
        {d.type === "memorandum" && (
          <label className="wide">
            <input
              type="checkbox"
              checked={d.memoEmblem}
              onChange={(e) => change({ memoEmblem: e.target.checked })}
            />
            ใช้ตราครุฑในบันทึกตามแบบคู่มือเพิ่มเติม
          </label>
        )}
        {d.type === "order" && (
          <label className="wide">
            รับคำสั่ง (เฉพาะกรณีมีอำนาจรับคำสั่ง)
            <input
              value={d.orderReceivedBy}
              onChange={(e) => change({ orderReceivedBy: e.target.value })}
              maxLength={200}
              placeholder="ตำแหน่งผู้มีอำนาจเจ้าของคำสั่ง"
            />
            <small>
              ปล่อยว่างหากเจ้าของคำสั่งลงนามเอง ต้องตรวจฐานอำนาจก่อนใช้
            </small>
          </label>
        )}
        {["internal", "memorandum"].includes(d.type) && (
          <p className="wide">
            หัวบันทึกข้อความใช้จุดไข่ปลาหลัง ส่วนราชการ ที่ วันที่ เรื่อง
            ตามแนวทางการพิมพ์
          </p>
        )}
        <label className="wide">
          ตราสำเนา
          <select
            value={d.copyMark}
            onChange={(e) =>
              change({ copyMark: e.target.value as Draft["copyMark"] })
            }
          >
            <option value="none">ต้นฉบับ — ไม่แสดงตราสำเนา</option>
            <option>สำเนา</option>
            <option>สำเนาคู่ฉบับ</option>
          </select>
        </label>
        <div className="wide stamp-buttons">
          {(["ปกติ", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={d.urgency === v}
              onClick={() => change({ urgency: v })}
            >
              {v === "ปกติ" ? "ไม่ระบุความเร็ว" : v}
            </button>
          ))}
        </div>
        <div className="wide stamp-buttons">
          {(["ปกติ", "ลับ", "ลับมาก", "ลับที่สุด"] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={d.confidentiality === v}
              onClick={() => change({ confidentiality: v })}
            >
              {v === "ปกติ" ? "ไม่ระบุชั้นความลับ" : v}
            </button>
          ))}
        </div>
        {d.confidentiality !== "ปกติ" && (
          <>
            {(
              [
                ["secretSetNumber", "เลขที่ชุด"],
                ["secretSetTotal", "จำนวนชุดทั้งหมด"],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={d[k]}
                  onChange={(e) => change({ [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <p className="field-note wide">
              แสดงหน่วยงานเจ้าของเรื่อง เลขที่ชุด และหน้าที่/จำนวนหน้าทุกหน้า
              ตามข้อ 32 ของระเบียบความลับ
            </p>
          </>
        )}
        <p className="field-note wide">
          ชั้นความเร็วสีแดง 32 pt • ชั้นความลับกึ่งกลางบน–ล่างทุกหน้า •
          ตราสำเนาเหนือส่วนหัว
        </p>
        <label className="check-label wide">
          <input
            type="checkbox"
            checked={d.productionMark}
            onChange={(e) => change({ productionMark: e.target.checked })}
          />
          {d.type === "external"
            ? "เพิ่มตราเสนอผ่านก่อนเสนอนายกฯ และช่องร่าง / พิมพ์ / ตรวจ"
            : "เพิ่มช่องร่าง / พิมพ์ / ตรวจท้ายเอกสาร"}
        </label>
        {d.productionMark &&
          (
            [
              ["drafter", "ผู้ร่าง"],
              ["typist", "ผู้พิมพ์"],
              ["checker", "ผู้ตรวจ / ทาน"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                value={d[k]}
                maxLength={200}
                onChange={(e) => change({ [k]: e.target.value })}
              />
            </label>
          ))}
        {d.type === "external" && d.productionMark && (
          <p className="field-note wide">
            จะแสดงภาพตราร่างและตรวจทานที่มุมขวาล่าง โดยวางทับเนื้อหาได้ตามแบบ
            ไม่ใช่ลายมือชื่อหรือการอนุมัติ
          </p>
        )}
        {d.type === "external" && d.copyMark === "สำเนาคู่ฉบับ" && (
          <p className="field-note wide">
            ตัวอย่างและ PDF จะแสดง ๒ ชุดในร่างเดียว:
            ฉบับจริงไม่มีตราสำเนา/ตราร่าง
            และสำเนามีตราสำเนาคู่ฉบับพร้อมภาพตราร่างที่มุมขวาล่าง
          </p>
        )}
        <label className="wide">
          ตัวเลขในเอกสาร
          <select
            value={d.numeralStyle}
            onChange={(e) =>
              change({ numeralStyle: e.target.value as Draft["numeralStyle"] })
            }
          >
            <option value="original">คงตามที่กรอก</option>
            <option value="thai">เลขไทย</option>
            <option value="arabic">เลขอารบิก</option>
          </select>
        </label>
        <div className="numeral-example wide">
          <span>0123456789 ↔ ๐๑๒๓๔๕๖๗๘๙</span>
          <small>
            เลขที่: {numerals(d.number || "123/2569", "arabic")} ↔{" "}
            {numerals(d.number || "123/2569", "thai")}
          </small>
        </div>
        <p className="field-note wide">
          การแปลงมีผลเฉพาะข้อความที่พิมพ์ออก วันที่จัดเก็บและอีเมลคงเดิม
          ชื่อที่กรอกในตรายังไม่ใช่ลายมือชื่อหรือการรับรองสำเนา
        </p>
      </div>
    </details>
  );
}
/* StructuredBody: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function StructuredBody({ draft: d, onChange: change }: Props) {
  return (
    <div className="wide">
      <label className="check-label">
        <input
          type="checkbox"
          checked={d.bodyMode === "structured"}
          onChange={(e) =>
            change({
              bodyMode: e.target.checked ? "structured" : "free",
              ...(e.target.checked &&
              !d.background &&
              !d.facts &&
              !d.legalBasis &&
              !d.consideration &&
              !d.proposal
                ? { background: d.body }
                : {}),
            })
          }
        />
        แยกเนื้อหาตามหน้าที่ของย่อหน้า
      </label>
      {d.bodyMode === "structured" ? (
        <>
          <p className="field-note">
            ข้อความเดิมยังอยู่ในโหมดอิสระ การแก้ไขแต่ละโหมดไม่เขียนทับกัน
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={d.sectionHeadings}
              onChange={(e) => change({ sectionHeadings: e.target.checked })}
            />
            พิมพ์ชื่อหัวข้อในเอกสาร
          </label>
          {(
            [
              ["background", "เรื่องเดิม", "ความเป็นมาและเหตุที่ทำหนังสือ"],
              ["facts", "ข้อเท็จจริง", "ข้อเท็จจริงและข้อมูลประกอบการพิจารณา"],
              [
                "legalBasis",
                "ข้อระเบียบ/กฎหมาย",
                "ชื่อระเบียบหรือกฎหมาย ฉบับแก้ไข และมาตรา/ข้อที่เกี่ยวข้อง",
              ],
              ["consideration", "ข้อพิจารณา", "ผลการพิจารณาและข้อเสนอแนะ"],
              [
                "proposal",
                "จึงเรียนมาเพื่อ…",
                "เช่น จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
              ],
            ] as const
          ).map(([k, label, hint]) => (
            <div key={k}>
              {k === "legalBasis" && (
                <LegalPicker draft={d} onChange={change} />
              )}
              <label className="body-section-input">
                {label}
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={d[k]}
                  placeholder={hint}
                  onChange={(e) => change({ [k]: e.target.value })}
                />
              </label>
              {k === "proposal" && (
                <ConclusionPicker draft={d} onChange={change} />
              )}
            </div>
          ))}
        </>
      ) : (
        <ConclusionPicker draft={d} onChange={change} />
      )}
    </div>
  );
}
const opinionPresets = [
  { title: "ความเห็นหัวหน้าสำนักปลัด", position: "หัวหน้าสำนักปลัดเทศบาล" },
  { title: "ความเห็นผู้อำนวยการกองคลัง", position: "ผู้อำนวยการกองคลัง" },
  { title: "ความเห็นผู้อำนวยการกองช่าง", position: "ผู้อำนวยการกองช่าง" },
  {
    title: "ความเห็นผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม",
    position: "ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม",
  },
  {
    title: "ความเห็นผู้อำนวยการกองการศึกษา",
    position: "ผู้อำนวยการกองการศึกษา",
  },
  {
    title: "ความเห็นผู้อำนวยการกองสวัสดิการสังคม",
    position: "ผู้อำนวยการกองสวัสดิการสังคม",
  },
  {
    title: "ความเห็นผู้อำนวยการกองยุทธศาสตร์และงบประมาณ",
    position: "ผู้อำนวยการกองยุทธศาสตร์และงบประมาณ",
  },
  { title: "ความเห็นรองปลัดเทศบาล", position: "รองปลัดเทศบาล" },
  { title: "ความเห็นปลัดเทศบาล", position: "ปลัดเทศบาล" },
  { title: "ความเห็นรองนายกเทศมนตรี", position: "รองนายกเทศมนตรี" },
  { title: "ความเห็นนายกเทศมนตรี", position: "นายกเทศมนตรี" },
];
const opinionPositions = [...new Set(opinionPresets.map((x) => x.position))];
/* officePosition: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function officePosition(position: string, organization: string) {
  const suffix = organization.replace(/^เทศบาล/, "");
  const localRoles = [
    "นายกเทศมนตรี",
    "รองนายกเทศมนตรี",
    "ปลัดเทศบาล",
    "รองปลัดเทศบาล",
    "หัวหน้าสำนักปลัดเทศบาล",
  ];
  return suffix &&
    organization.startsWith("เทศบาล") &&
    localRoles.includes(position)
    ? `${position}${suffix}`
    : position;
}
/* ReviewChain: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function ReviewChain({ draft: d, onChange: change }: Props) {
  const [newOpinionTitle, setNewOpinionTitle] = useState("ความเห็นปลัดเทศบาล");
  if (!["internal", "memorandum"].includes(d.type)) return null;
  const updateOpinion = (
    index: number,
    patch: Partial<Draft["opinions"][number]>,
  ) => {
    const current = d.opinions[index],
      next = { ...current, ...patch };
    if (typeof patch.title === "string" && patch.title !== current.title) {
      const target = opinionPresets.find((x) => x.title === patch.title);
      if (target)
        next.position = officePosition(target.position, d.organization);
    }
    change({ opinions: d.opinions.map((x, i) => (i === index ? next : x)) });
  };
  const addOpinion = () => {
    const preset =
      opinionPresets.find((x) => x.title === newOpinionTitle) ||
      opinionPresets[8];
    change({
      opinions: [
        ...d.opinions,
        {
          title: preset.title,
          comment: "",
          name: "",
          position: officePosition(preset.position, d.organization),
          showDate: true,
          lines: 3,
        },
      ],
    });
  };
  return (
    <details className="form-section" open>
      <summary>
        <strong>ผู้เสนอเพิ่มเติมและความเห็นตามลำดับ</strong>
      </summary>
      <div className="field-grid">
        <p className="field-note wide">
          เพิ่มผู้เสนอได้อีก 5 คน และเพิ่มความเห็นได้สูงสุด 5 ส่วน
          เรียงตามลำดับเสนอเพื่อพิจารณา
        </p>
        {d.proposers.map((p, i) => (
          <div className="repeat-card wide" key={i}>
            <strong>ผู้เสนอเพิ่มเติม {i + 1}</strong>
            <label>
              ชื่อผู้เสนอ
              <input
                value={p.name}
                maxLength={200}
                onChange={(e) =>
                  change({
                    proposers: d.proposers.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              ตำแหน่งผู้เสนอ
              <input
                value={p.position}
                maxLength={300}
                onChange={(e) =>
                  change({
                    proposers: d.proposers.map((x, j) =>
                      j === i ? { ...x, position: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                change({ proposers: d.proposers.filter((_, j) => j !== i) })
              }
            >
              ลบผู้เสนอ
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary wide"
          disabled={d.proposers.length >= 5}
          onClick={() =>
            change({ proposers: [...d.proposers, { name: "", position: "" }] })
          }
        >
          + เพิ่มผู้เสนอ
        </button>
        {d.opinions.map((p, i) => (
          <div className="repeat-card wide" key={i}>
            <label>
              หัวข้อความเห็น
              <input
                list="opinion-titles"
                value={p.title}
                maxLength={200}
                placeholder="เช่น ความเห็นปลัดเทศบาล"
                onChange={(e) => updateOpinion(i, { title: e.target.value })}
              />
            </label>
            <label>
              ข้อความเห็น
              <textarea
                value={p.comment}
                rows={3}
                maxLength={3000}
                placeholder="เว้นว่างเพื่อแสดงเส้นประสำหรับเขียนความเห็น"
                onChange={(e) => updateOpinion(i, { comment: e.target.value })}
              />
            </label>
            <label>
              บรรทัดว่าง
              <select
                value={p.lines}
                onChange={(e) =>
                  updateOpinion(i, { lines: Number(e.target.value) })
                }
              >
                <option value={1}>1 บรรทัด</option>
                <option value={2}>2 บรรทัด</option>
                <option value={3}>3 บรรทัด</option>
              </select>
            </label>
            <label>
              ชื่อผู้ให้ความเห็น
              <input
                value={p.name}
                maxLength={300}
                onChange={(e) => updateOpinion(i, { name: e.target.value })}
              />
            </label>
            <label>
              ตำแหน่งผู้ให้ความเห็น
              <input
                list="opinion-positions"
                value={p.position}
                maxLength={300}
                placeholder="เลือกตำแหน่งหรือพิมพ์เอง"
                onChange={(e) => updateOpinion(i, { position: e.target.value })}
              />
            </label>
            <label className="check-label wide">
              <input
                type="checkbox"
                checked={p.showDate !== false}
                onChange={(e) =>
                  updateOpinion(i, { showDate: e.target.checked })
                }
              />
              แสดงบรรทัดวันที่ใต้ชื่อ/ตำแหน่งผู้ให้ความเห็น
            </label>
            <div className="stamp-buttons">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const a = [...d.opinions];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  change({ opinions: a });
                }}
              >
                เลื่อนขึ้น
              </button>
              <button
                type="button"
                onClick={() =>
                  change({ opinions: d.opinions.filter((_, j) => j !== i) })
                }
              >
                ลบความเห็น
              </button>
            </div>
          </div>
        ))}
        <datalist id="opinion-titles">
          {opinionPresets.map((x) => (
            <option key={x.title} value={x.title} />
          ))}
        </datalist>
        <datalist id="opinion-positions">
          {opinionPositions.map((position) => (
            <option
              key={officePosition(position, d.organization)}
              value={officePosition(position, d.organization)}
            />
          ))}
        </datalist>
        <label className="wide">
          เลือกหัวข้อความเห็นและตำแหน่งเริ่มต้น
          <select
            value={newOpinionTitle}
            onChange={(e) => setNewOpinionTitle(e.target.value)}
          >
            {opinionPresets.map((x) => (
              <option key={x.title} value={x.title}>
                {x.title} — {officePosition(x.position, d.organization)}
              </option>
            ))}
          </select>
          <small>เติมตำแหน่งตามส่วนราชการโดยอัตโนมัติ แก้ไขเองได้ภายหลัง</small>
        </label>
        <button
          type="button"
          className="secondary wide"
          disabled={d.opinions.length >= 5}
          onClick={addOpinion}
        >
          + เพิ่มส่วนความเห็น ({d.opinions.length}/5)
        </button>
      </div>
    </details>
  );
}
/* ชนิด LegalItem: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type LegalItem = Awaited<ReturnType<typeof listLegalReferences>>[number];
/* LegalLibrary: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function LegalLibrary({ draft: d, onChange: change }: Props) {
  const [items, setItems] = useState<LegalItem[]>([]),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<LegalItem | null>(null),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  /* run: เครื่องมือร่าง: ตราสำเนา ตัวเลข เนื้อหาแบบหัวข้อ สายความเห็น และกฎหมายอ้างอิง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function run(task: () => Promise<void>) {
    start(async () => {
      try {
        await task();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }
  useEffect(() => {
    let active = true;
    listLegalReferences()
      .then((v) => {
        if (active) setItems(v);
      })
      .catch(() => {
        if (active) setMessage("โหลดคลังไม่ได้ กรุณาเปิดใหม่");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <details className="form-section">
      <summary>
        <strong>คลังกฎหมายและเอกสารอ้างอิง</strong>
      </summary>
      <div className="field-grid">
        <label className="wide">
          ระยะขอบบนหน้าแรก
          <select
            value={d.firstPageTop}
            onChange={(e) =>
              change({ firstPageTop: e.target.value as Draft["firstPageTop"] })
            }
          >
            <option value="15">1.5 ซม. — แนวทางเดิม</option>
            <option value="25">2.5 ซม. — เผื่อตรารับ ตามคู่มือเพิ่มเติม</option>
          </select>
        </label>
        {d.type === "memorandum" && (
          <label className="wide">
            <input
              type="checkbox"
              checked={d.memoEmblem}
              onChange={(e) => change({ memoEmblem: e.target.checked })}
            />
            ใช้ตราครุฑในบันทึกตามแบบคู่มือเพิ่มเติม
          </label>
        )}
        {d.type === "order" && (
          <label className="wide">
            รับคำสั่ง (เฉพาะกรณีมีอำนาจรับคำสั่ง)
            <input
              value={d.orderReceivedBy}
              onChange={(e) => change({ orderReceivedBy: e.target.value })}
              maxLength={200}
              placeholder="ตำแหน่งผู้มีอำนาจเจ้าของคำสั่ง"
            />
            <small>
              ปล่อยว่างหากเจ้าของคำสั่งลงนามเอง ต้องตรวจฐานอำนาจก่อนใช้
            </small>
          </label>
        )}
        <label className="wide">
          ค้นหาชื่อกฎหมาย / มาตรา
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาจากคลังของหน่วยงาน"
          />
        </label>
        {items
          .filter((x) => `${x.title} ${x.section} ${x.notes}`.includes(query))
          .map((x) => (
            <div className="repeat-card wide" key={x.id}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={d.legalReferenceIds.includes(x.id)}
                  onChange={(e) =>
                    change({
                      legalReferenceIds: e.target.checked
                        ? [...d.legalReferenceIds, x.id]
                        : d.legalReferenceIds.filter((id) => id !== x.id),
                    })
                  }
                />
                <strong>{x.title}</strong>
              </label>
              <p>{x.section}</p>
              <p className="field-note">{x.notes}</p>
              <div className="stamp-buttons">
                {x.url && (
                  <a href={x.url} target="_blank" rel="noreferrer">
                    เปิดแหล่งต้นฉบับ
                  </a>
                )}
                {x.fileName && (
                  <a
                    href={`/api/legal/${x.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ดาวน์โหลด PDF
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    change({
                      bodyMode: "structured",
                      background: d.bodyMode === "free" ? d.body : d.background,
                      legalBasis: [
                        d.legalBasis,
                        [x.title, x.section].filter(Boolean).join(" "),
                      ]
                        .filter(Boolean)
                        .join("\n"),
                      legalReferenceIds: Array.from(
                        new Set([...d.legalReferenceIds, x.id]),
                      ),
                    })
                  }
                >
                  แทรกชื่อในข้อกฎหมาย
                </button>
                <button type="button" onClick={() => openReference(x)}>
                  เปิดอ่านข้างร่าง
                </button>
                <button type="button" onClick={() => setEditing(x)}>
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("ลบรายการกฎหมายนี้จากคลังหรือไม่?"))
                      run(async () => {
                        await deleteLegalReference(x.id);
                        setItems(await listLegalReferences());
                      });
                  }}
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        {!items.length && (
          <p className="field-note wide">
            ยังไม่มีรายการ เพิ่มกฎหมายฉบับจริงพร้อมมาตรา/ข้อ ลิงก์ หรือ PDF
            ด้านล่าง
          </p>
        )}
        <form
          key={editing?.id || "new"}
          className="repeat-card wide"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run(async () => {
              await saveLegalReference(form);
              setItems(await listLegalReferences());
              window.dispatchEvent(new Event("sarabun-library-updated"));
              setEditing(null);
              setMessage("บันทึกคลังกฎหมายแล้ว");
            });
          }}
        >
          <strong>{editing ? "แก้ไขกฎหมาย" : "เพิ่มกฎหมายเข้าคลัง"}</strong>
          {editing && (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="updatedAt" value={editing.updatedAt} />
            </>
          )}
          <label>
            ชื่อกฎหมายและฉบับแก้ไข
            <input
              name="title"
              required
              maxLength={300}
              defaultValue={editing?.title}
            />
          </label>
          <label>
            มาตรา / ข้อ
            <input
              name="section"
              maxLength={300}
              defaultValue={editing?.section}
            />
          </label>
          <label>
            ลิงก์แหล่งต้นฉบับ
            <input name="url" type="url" defaultValue={editing?.url} />
          </label>
          <label>
            สาระสำคัญ / วันที่ตรวจสอบสถานะ
            <textarea
              name="notes"
              rows={3}
              maxLength={10000}
              defaultValue={editing?.notes}
            />
          </label>
          <label>
            แนบ PDF (ไม่เกิน 10 MB)
            <input name="file" type="file" accept="application/pdf" />
          </label>
          <p className="field-note">
            เก็บไฟล์ในฐานข้อมูลของระบบ
            การเลือกอ้างอิงไม่ใช่การยืนยันว่ากฎหมายยังใช้บังคับ
            โปรดตรวจฉบับแก้ไขจากต้นฉบับ
          </p>
          <button className="secondary" disabled={pending}>
            บันทึกเข้าคลัง
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              ยกเลิกแก้ไข
            </button>
          )}
        </form>
        {message && (
          <p role="status" className="wide">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
