"use server";
/**
 * แผนที่อ่านโค้ด — src/app/attachment-actions.ts
 * หน้าที่: รับไฟล์แนบจาก FormData ตรวจสิทธิ์แล้วส่งให้ attachments.ts จัดเก็บ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ../components/attachment-editor.tsx
 * 3. ./attachment-actions.ts ← คุณอยู่ที่นี่
 * 4. ../lib/attachments.ts
 * 5. ../lib/pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/attachment-editor.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/attachments.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/attachments.ts — รับ PDF/ภาพ ตรวจเนื้อไฟล์ เก็บต้นฉบับและฉบับสำหรับพิมพ์ แล้วรวมท้าย PDF ของหนังสือ */
import { createAttachment } from "@/lib/attachments";
/* uploadAttachment: รับไฟล์แนบจาก FormData ตรวจสิทธิ์แล้วส่งให้ attachments.ts จัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function uploadAttachment(form: FormData) {
  await requireUser();
  try {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("กรุณาเลือกไฟล์");
    return { ok: true as const, data: await createAttachment(file) };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ",
    };
  }
}
