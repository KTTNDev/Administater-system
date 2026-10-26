"use client";
/**
 * แผนที่อ่านโค้ด — src/components/action-search.tsx
 * หน้าที่: กล่องค้นทางลัด รับคีย์บอร์ดและส่งหน้าปลายทางกลับไป Workspace
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
 * อ่านต่อจาก import: ../lib/action-search.ts, ./action-search.module.css
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useRef, useState } from "react";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { Search, ArrowUpRight, X } from "lucide-react";
/* นำเข้า ../lib/action-search.ts — จัดอันดับทางลัดตามคำค้นด้วยกฎข้อความ ไม่ได้เรียกโมเดล AI */
import { searchWorkActions, type WorkAction } from "@/lib/action-search";
/* นำเข้า ./action-search.module.css — กฎหน้าตาและขนาดของ component ชื่อเดียวกับไฟล์นี้; ไม่ใช่กฎหน้ากระดาษ PDF ซึ่งอยู่ใน render-document.ts */
import s from "./action-search.module.css";
/* ActionSearch: กล่องค้นทางลัด รับคีย์บอร์ดและส่งหน้าปลายทางกลับไป Workspace — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function ActionSearch({
  onChoose,
}: {
  onChoose: (action: WorkAction) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const results = searchWorkActions(query);
  /* open: กล่องค้นทางลัด รับคีย์บอร์ดและส่งหน้าปลายทางกลับไป Workspace — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function open() {
    if (!dialog.current?.open) {
      setQuery("");
      dialog.current?.showModal();
      input.current?.focus();
    }
  }
  /* close: กล่องค้นทางลัด รับคีย์บอร์ดและส่งหน้าปลายทางกลับไป Workspace — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  /* choose: กล่องค้นทางลัด รับคีย์บอร์ดและส่งหน้าปลายทางกลับไป Workspace — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function choose(action: WorkAction) {
    close();
    onChoose(action);
  }
  return (
    <>
      <button ref={trigger} type="button" className={s.trigger} onClick={open}>
        <Search size={18} />
        <span>อยากทำอะไร?</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="action-search-title"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const r = dialog.current.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <div className={s.header}>
          <div>
            <h2 id="action-search-title">อยากทำอะไร?</h2>
            <p>บอกงานที่ต้องการ แล้วเลือกทางลัดที่เหมาะกับคุณ</p>
          </div>
          <button type="button" onClick={close} aria-label="ปิดค้นหางาน">
            <X size={20} />
          </button>
        </div>
        <div className={s.input}>
          <Search size={21} />
          <input
            ref={input}
            aria-label="ค้นหาเมนูด้วยสิ่งที่ต้องการทำ"
            placeholder="เช่น โอนงบซื้อคอม หรือนัดประชุม"
            value={query}
            maxLength={250}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                dialog.current
                  ?.querySelector<HTMLButtonElement>("[data-result]")
                  ?.focus();
              }
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                choose(results[0].action);
              }
            }}
          />
        </div>
        {!query && (
          <div className={s.examples}>
            {["โอนงบซื้อคอม", "นัดประชุม", "กู้คืนข้อมูล"].map((text) => (
              <button
                type="button"
                key={text}
                onClick={() => {
                  setQuery(text);
                  input.current?.focus();
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}
        <p className={s.count} aria-live="polite">
          {query ? `พบ ${results.length} ทางลัดที่เกี่ยวข้อง` : "งานที่ใช้บ่อย"}
        </p>
        <div className={s.results}>
          {results.map(({ action, matched }, i) => (
            <button
              type="button"
              data-result
              key={action.id}
              className={s.result}
              onClick={() => choose(action)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const buttons =
                  dialog.current?.querySelectorAll<HTMLButtonElement>(
                    "[data-result]",
                  );
                if (e.key === "ArrowUp" && i === 0) input.current?.focus();
                else
                  buttons?.[
                    Math.max(
                      0,
                      Math.min(
                        results.length - 1,
                        i + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    )
                  ]?.focus();
              }}
            >
              <span>
                <strong>{action.title}</strong>
                <small>{action.description}</small>
                {query && matched.length > 0 && (
                  <em>เกี่ยวข้องกับ: {matched.slice(0, 2).join(" · ")}</em>
                )}
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
        {query && !results.length && (
          <div className={s.empty}>
            ยังไม่พบงานที่ตรง ลองใช้คำว่า “หนังสือ” “ประชุม” “งบประมาณ” หรือ
            “กฎหมาย”
            <button
              type="button"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              ดูทางลัดเริ่มต้น
            </button>
          </div>
        )}
        <footer className={s.footer}>
          ค้นจากคำและคำใกล้เคียงในระบบ · ไม่ส่งข้อความไปบริการ AI ภายนอก
          <br />↑ ↓ เลือก · Enter เปิด · Esc ปิด
        </footer>
      </dialog>
    </>
  );
}
