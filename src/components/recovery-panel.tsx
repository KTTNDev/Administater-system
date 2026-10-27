"use client";
/**
 * แผนที่อ่านโค้ด — src/components/recovery-panel.tsx
 * หน้าที่: เชื่อมการเก็บร่างกู้คืนและการเลือกคืนข้อมูลเข้าฟอร์ม
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./recovery-panel.tsx ← คุณอยู่ที่นี่
 * 2. ../app/recovery-actions.ts
 * 3. ../lib/recovery.ts
 * 4. ../lib/document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./budget-transfers.tsx, ./workspace.tsx
 * อ่านต่อจาก import: ../app/recovery-actions.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useRef, useState } from "react";
/* นำเข้า ../app/recovery-actions.ts — รับ/อ่านร่างกู้คืนหลังตรวจสิทธิ์ เพื่อช่วยนำข้อความที่ยังไม่บันทึกกลับมา */
import {
  saveRecovery,
  getRecoveryList,
  getRecovery,
} from "@/app/recovery-actions";
/* ชนิด Scope: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Scope = "document" | "budget";
/* RecoveryPanel: เชื่อมการเก็บร่างกู้คืนและการเลือกคืนข้อมูลเข้าฟอร์ม — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function RecoveryPanel({
  scope,
  value,
  enabled,
  contextKey,
  onRestore,
}: {
  scope: Scope;
  value: unknown;
  enabled: boolean;
  contextKey: string;
  onRestore: (value: unknown) => void;
}) {
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [rows, setRows] = useState<{ id: string; title: string; at: string }[]>([]),
    [open, setOpen] = useState(false);
  const generation = useRef(0),
    key = useRef(""),
    identity = useRef(""),
    sequence = useRef(0);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (key.current !== contextKey || !identity.current) {
      key.current = contextKey;
      identity.current = crypto.randomUUID();
      sequence.current = 0;
    }
    const ticket = ++generation.current;
    if (!enabled) return;
    setStatus("รอบันทึกสำเนากู้คืน…");
    const id = identity.current,
      seq = ++sequence.current;
    const timer = setTimeout(() => {
      setStatus("กำลังบันทึกสำเนากู้คืน…");
      saveRecovery({ id, scope, sequence: seq, data: JSON.parse(serialized) })
        .then(() => {
          if (generation.current === ticket) setStatus("บันทึกสำเนากู้คืนแล้ว");
        })
        .catch(() => {
          if (generation.current === ticket)
            setStatus(
              "สำเนากู้คืนยังไม่บันทึก กรุณากดบันทึกงานเอง และตรวจการเชื่อมต่อหรือข้อมูล",
            );
        });
    }, 1500);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [serialized, enabled, contextKey, scope]);
  /* show: เชื่อมการเก็บร่างกู้คืนและการเลือกคืนข้อมูลเข้าฟอร์ม — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  async function show() {
    setError("");
    try {
      setRows(await getRecoveryList(scope));
      setOpen(true);
    } catch {
      setError("โหลดสำเนากู้คืนไม่สำเร็จ กรุณาลองใหม่");
    }
  }
  return (
    <section
      className="recovery-panel"
      style={{
        padding: 12,
        margin: "12px 0",
        background: "var(--theme-tint, #edf7f3)",
        borderRadius: 10,
      }}
    >
      <span aria-live="polite">
        {enabled ? status : "สำเนากู้คืนอัตโนมัติ · เก็บแยกจากทะเบียน"}
      </span>
      {error && <p role="alert">{error}</p>}{" "}
      <button type="button" onClick={show}>
        เปิดสำเนากู้คืน
      </button>
      {open && (
        <div>
          <p>
            กู้เป็นร่างใหม่ ไม่เขียนทับฉบับเดิม · สำเนาอยู่บนเครื่องที่รันระบบ
            ยังไม่ใช่สำรองนอกเครื่อง
          </p>
          <button type="button" onClick={() => setOpen(false)}>
            ปิดรายการ
          </button>
          {!rows.length ? (
            <p>ยังไม่มีสำเนากู้คืน</p>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        enabled &&
                        !confirm(
                          "เปิดสำเนานี้เป็นร่างใหม่แทนงานบนหน้าจอหรือไม่? ควรกดบันทึกงานปัจจุบันก่อน",
                        )
                      )
                        return;
                      try {
                        const data = await getRecovery(r.id, scope);
                        onRestore(data);
                        setOpen(false);
                      } catch {
                        setError("เปิดสำเนาไม่สำเร็จ กรุณาลองใหม่");
                      }
                    }}
                  >
                    {r.title} — {new Date(r.at).toLocaleString("th-TH")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
