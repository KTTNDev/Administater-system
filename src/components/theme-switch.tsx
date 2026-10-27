"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** การตั้งค่าหน้าจอเท่านั้น: ไม่ใส่ theme ลง Draft หรือส่งให้ documentHtml/PDF
 * อ่านก่อน: app/layout.tsx (คืนค่าก่อนวาดหน้า) → ไฟล์นี้ → app/workspace-theme.css
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.uiTheme === "dim" ? "dim" : "light");
    const sync = (event: StorageEvent) => {
      if (event.key !== "sarabun-ui-theme") return;
      const next = event.newValue === "dim" ? "dim" : "light";
      document.documentElement.dataset.uiTheme = next;
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose(next: "light" | "dim") {
    document.documentElement.dataset.uiTheme = next;
    setTheme(next);
    // บาง browser ปิด localStorage; ยังเปลี่ยนธีมในหน้านี้ได้ตามปกติ
    try { localStorage.setItem("sarabun-ui-theme", next); } catch {}
  }
  return (
    <div className="theme-switch" role="group" aria-label="สีพื้นที่ทำงาน">
      <button type="button" aria-label="สว่างนุ่ม" title="สว่างนุ่ม — กระดาษคงสีเดิม" aria-pressed={theme === "light"} onClick={() => choose("light")}><Sun size={16} /><span>สว่าง</span></button>
      <button type="button" aria-label="มืดนุ่ม" title="มืดนุ่ม — กระดาษคงสีเดิม" aria-pressed={theme === "dim"} onClick={() => choose("dim")}><Moon size={16} /><span>มืดนุ่ม</span></button>
    </div>
  );
}
