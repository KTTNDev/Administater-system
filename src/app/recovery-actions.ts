"use server";
/**
 * แผนที่อ่านโค้ด — src/app/recovery-actions.ts
 * หน้าที่: รับ/อ่านร่างกู้คืนหลังตรวจสิทธิ์ เพื่อช่วยนำข้อความที่ยังไม่บันทึกกลับมา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/recovery-panel.tsx
 * 2. ./recovery-actions.ts ← คุณอยู่ที่นี่
 * 3. ../lib/recovery.ts
 * 4. ../lib/document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/recovery-panel.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/recovery.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/recovery.ts — เก็บร่างกู้คืนของฟอร์ม แยกจากเอกสารที่ผู้ใช้กดบันทึกจริง */
import {
  storeRecovery,
  listRecovery,
  readRecovery,
  type RecoveryScope,
} from "@/lib/recovery";
/* saveRecovery: รับ/อ่านร่างกู้คืนหลังตรวจสิทธิ์ เพื่อช่วยนำข้อความที่ยังไม่บันทึกกลับมา — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function saveRecovery(input: unknown) {
  await requireUser();
  return storeRecovery(input);
}
/* getRecoveryList: รับ/อ่านร่างกู้คืนหลังตรวจสิทธิ์ เพื่อช่วยนำข้อความที่ยังไม่บันทึกกลับมา — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getRecoveryList(scope: RecoveryScope) {
  await requireUser();
  return listRecovery(scope);
}
/* getRecovery: รับ/อ่านร่างกู้คืนหลังตรวจสิทธิ์ เพื่อช่วยนำข้อความที่ยังไม่บันทึกกลับมา — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getRecovery(id: string, scope: RecoveryScope) {
  await requireUser();
  return readRecovery(id, scope);
}
