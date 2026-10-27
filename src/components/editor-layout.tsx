"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GripVertical, RotateCcw } from "lucide-react";

const DEFAULT_SHARE = 46;
const MIN_SHARE = 35;
const MAX_SHARE = 65;
const clamp = (value: number) =>
  Math.min(MAX_SHARE, Math.max(MIN_SHARE, value));

/** อ่าน Workspace → EditorLayout → workspace-theme.css
 * เปลี่ยนเฉพาะขนาดพื้นที่รอบ iframe ไม่แก้ zoom/srcDoc/ขนาด A4 ของเอกสาร
 * เก็บความชอบแยกจาก Draft; ค่าที่เสียหรือ storage ที่ถูกปิดไม่ทำให้เปิดฟอร์มไม่ได้
 */
export function EditorLayout({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const current = useRef(DEFAULT_SHARE);
  const [share, setShare] = useState(DEFAULT_SHARE);
  const [dragging, setDragging] = useState(false);
  const panes = Children.toArray(children);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sarabun-editor-share");
      if (stored !== null && Number.isFinite(Number(stored))) {
        current.current = clamp(Number(stored));
        setShare(current.current);
      }
    } catch {}
  }, []);
  function change(value: number, persist = false) {
    current.current = clamp(value);
    setShare(current.current);
    if (persist) {
      try {
        localStorage.setItem("sarabun-editor-share", String(current.current));
      } catch {}
    }
  }
  return (
    <div
      ref={root}
      className={`editor-layout adjustable-layout${dragging ? " is-resizing" : ""}`}
      style={{ "--form-share": `${share}%` } as CSSProperties}
    >
      {panes[0]}
      <div className="editor-divider">
        <div
          role="separator"
          aria-label="ปรับความกว้างพื้นที่กรอก"
          aria-orientation="vertical"
          aria-valuemin={MIN_SHARE}
          aria-valuemax={MAX_SHARE}
          aria-valuenow={Math.round(share)}
          aria-valuetext={`พื้นที่กรอก ${Math.round(share)} เปอร์เซ็นต์`}
          tabIndex={0}
          title="ลากเพื่อปรับพื้นที่ หรือใช้ปุ่มลูกศรซ้าย–ขวา"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const box = root.current!.getBoundingClientRect();
            change(((event.clientX - box.left) / box.width) * 100);
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragging(false);
            change(current.current, true);
          }}
          onLostPointerCapture={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onDoubleClick={() => change(DEFAULT_SHARE, true)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowLeft"
                ? current.current - 2
                : event.key === "ArrowRight"
                  ? current.current + 2
                  : event.key === "Home"
                    ? MIN_SHARE
                    : event.key === "End"
                      ? MAX_SHARE
                      : null;
            if (next === null) return;
            event.preventDefault();
            change(next, true);
          }}
        >
          <GripVertical size={12} aria-hidden="true" />
        </div>
        <button
          type="button"
          title="คืนสัดส่วนพื้นที่เดิม"
          aria-label="คืนสัดส่วนพื้นที่เดิม"
          onClick={() => change(DEFAULT_SHARE, true)}
        >
          <RotateCcw size={12} />
        </button>
      </div>
      {panes[1]}
    </div>
  );
}
