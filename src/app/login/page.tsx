"use client";
/**
 * แผนที่อ่านโค้ด — src/app/login/page.tsx
 * หน้าที่: แบบกรอกรหัสผ่าน ใช้ useActionState รับผลจาก login ใน actions.ts
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../page.tsx
 * 2. ../../components/workspace.tsx
 * 3. ../../lib/document.ts
 * 4. ../actions.ts
 * 5. ../../lib/db.ts
 * 6. ../../lib/render-document.ts
 * 7. ../api/documents/[id]/pdf/route.ts
 * 8. ../../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../actions.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useActionState } from "react";
/* นำเข้า ../actions.ts — จุดรับคำสั่งจากหน้าจอ: ตรวจสิทธิ์และข้อมูลก่อนบันทึก ลบ ทำสำเนา หรือส่งไป Drive */
import { login } from "../actions";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { Files, ArrowRight } from "lucide-react";
/* Login: แบบกรอกรหัสผ่าน ใช้ useActionState รับผลจาก login ใน actions.ts — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export default function Login() {
  const [error, action, pending] = useActionState(login, "");
  return (
    <main className="login-page">
      <form action={action} className="login-card">
        <div className="brand-icon">
          <Files size={28} />
        </div>
        <div className="eyebrow">SARABUN WORKSPACE</div>
        <h1>ยินดีต้อนรับกลับ</h1>
        <p>เข้าสู่พื้นที่ทำงานเอกสารราชการของหน่วยงาน</p>
        <label>
          รหัสผ่านผู้ปฏิบัติงาน
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button className="primary" disabled={pending}>
          {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          <ArrowRight size={18} />
        </button>
        <small>
          ตั้งค่า APP_PASSWORD และ SESSION_SECRET ใน .env.local
          <br />
          รุ่นเริ่มต้นสำหรับผู้ปฏิบัติงานหนึ่งหน่วยงาน
        </small>
      </form>
    </main>
  );
}
