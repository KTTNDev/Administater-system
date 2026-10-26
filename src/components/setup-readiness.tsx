"use client";
/**
 * แผนที่อ่านโค้ด — src/components/setup-readiness.tsx
 * หน้าที่: แสดงผลตรวจความพร้อมและปุ่มตรวจซ้ำ อ่านข้อมูลจาก setup-actions
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
 * อ่านต่อจาก import: ../app/setup-actions.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useState } from "react";
/* นำเข้า ../app/setup-actions.ts — ตรวจความพร้อมการตั้งค่าฝั่งเซิร์ฟเวอร์ โดยส่งกลับสถานะ ไม่ส่งรหัสลับไป UI */
import { getSetupReadiness } from "@/app/setup-actions";
/* SetupReadiness: แสดงผลตรวจความพร้อมและปุ่มตรวจซ้ำ อ่านข้อมูลจาก setup-actions — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function SetupReadiness() {
  const [state, setState] = useState<Awaited<
      ReturnType<typeof getSetupReadiness>
    > | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  /* refresh: แสดงผลตรวจความพร้อมและปุ่มตรวจซ้ำ อ่านข้อมูลจาก setup-actions — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setState(await getSetupReadiness());
    } catch {
      setError("ตรวจสถานะไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <section className="panel settings-card" aria-label="ความพร้อมใช้งานจริง">
      <h2>ความพร้อมใช้งานจริง</h2>
      <p>
        ตรวจการตั้งค่าของเซิร์ฟเวอร์ที่กำลังรัน โดยไม่แสดงรหัสผ่านหรือคีย์ลับ
      </p>
      <button disabled={busy} onClick={refresh}>
        {busy ? "กำลังตรวจ…" : "ตรวจสถานะอีกครั้ง"}
      </button>
      {error && <p role="alert">{error}</p>}
      {state && (
        <>
          <ul>
            <li>
              {state.passwordReady ? "✓" : "○"} รหัสผ่านผู้ปฏิบัติงาน:{" "}
              {state.passwordReady ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}
            </li>
            <li>
              {state.secretReady ? "✓" : "○"} คีย์รักษาเซสชัน:{" "}
              {state.secretReady ? "พร้อม" : "ยังไม่พร้อม"}
            </li>
            <li>
              {state.production ? "✓" : "○"} โหมดปัจจุบัน:{" "}
              {state.production ? "ใช้งานจริง" : "พัฒนา"}
            </li>
            <li>
              {state.drive.configured ? "✓" : "○"} Google OAuth Client:{" "}
              {state.drive.configured ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}
            </li>
            <li>
              {state.drive.connected ? "✓" : "○"} บัญชี Google:{" "}
              {state.drive.connected
                ? "บันทึกการเชื่อมต่อแล้ว — ยังควรกดทดสอบ Drive"
                : "ยังไม่ได้เชื่อมต่อ"}
            </li>
          </ul>
          <details>
            <summary>ตั้งรหัสผ่านและเปิดใช้งานจริง</summary>
            <ol>
              <li>
                เปิดไฟล์นี้ใน File Explorer: <code>{state.setupPath}</code>
              </li>
              <li>
                ตั้งรหัสผ่านอย่างน้อย 12 ตัวอักษรและยืนยันอีกครั้ง
                รหัสจะไม่แสดงขณะพิมพ์
              </li>
              <li>
                รัน <code>npm run build</code> แล้วปิดเซิร์ฟเวอร์โหมดพัฒนา
              </li>
              <li>
                เปิด <code>{state.launcherPath}</code> และเข้าสู่ระบบ
              </li>
            </ol>
            <p>
              การเปลี่ยนไฟล์ตั้งค่าต้องเริ่มเซิร์ฟเวอร์ใหม่ก่อน
              สถานะหน้านี้จึงจะเปลี่ยน
              บัญชีปัจจุบันเป็นบัญชีร่วมของผู้ปฏิบัติงาน
            </p>
          </details>
          <details>
            <summary>สิ่งที่ต้องเตรียมสำหรับ Google Drive</summary>
            <p>
              ต้องใช้ OAuth Client แบบ Web application ของเว็บไซต์ และไฟล์ JSON
              ที่ดาวน์โหลดจาก Google Cloud การเชื่อม Drive
              ในแชทไม่ได้ให้สิทธิ์แก่เว็บไซต์
            </p>
            <p>
              Redirect URI ที่ต้องตรงกัน: <code>{state.callback}</code>
            </p>
            <p>
              เมื่อมีไฟล์แล้ว ใช้{" "}
              <code>node scripts/setup-google-oauth.mjs "พาธไฟล์.json"</code>{" "}
              จากโฟลเดอร์โปรเจกต์ เริ่มเซิร์ฟเวอร์ใหม่ แล้วกดเชื่อมบัญชีและทดสอบ
              Drive
            </p>
            <p>
              อย่าส่งรหัสผ่าน Client Secret หรือเนื้อหาไฟล์ JSON ลงแชทหรือ
              GitHub
            </p>
          </details>
        </>
      )}
    </section>
  );
}
