"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { Files,ArrowRight } from "lucide-react";
export default function Login(){const [error,action,pending]=useActionState(login,"");return <main className="login-page"><form action={action} className="login-card"><div className="brand-icon"><Files size={28}/></div><div className="eyebrow">SARABUN WORKSPACE</div><h1>ยินดีต้อนรับกลับ</h1><p>เข้าสู่พื้นที่ทำงานเอกสารราชการของหน่วยงาน</p><label>รหัสผ่านผู้ปฏิบัติงาน<input name="password" type="password" autoComplete="current-password" required autoFocus/></label>{error&&<p role="alert" className="error-text">{error}</p>}<button className="primary" disabled={pending}>{pending?"กำลังตรวจสอบ…":"เข้าสู่ระบบ"}<ArrowRight size={18}/></button><small>ตั้งค่า APP_PASSWORD และ SESSION_SECRET ใน .env.local<br/>รุ่นเริ่มต้นสำหรับผู้ปฏิบัติงานหนึ่งหน่วยงาน</small></form></main>}
