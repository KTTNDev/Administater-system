"use server";
/**
 * แผนที่อ่านโค้ด — src/app/budget-actions.ts
 * หน้าที่: รับคำสั่งโอนงบจาก UI แล้วตรวจสิทธิ์ก่อนบันทึกหรือสร้างหนังสือ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/budget.ts
 * 2. ../components/budget-transfers.tsx
 * 3. ./budget-actions.ts ← คุณอยู่ที่นี่
 * 4. ../lib/budget-db.ts
 * 5. ../lib/budget-document.ts
 * 6. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/budget-transfers.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/budget-db.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า next/cache — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { revalidatePath } from "next/cache";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/budget-db.ts — เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ */
import {
  listBudgets,
  saveBudgetRecord,
  removeBudgetRecord,
  generateBudgetDocument,
} from "@/lib/budget-db";
/* getBudgets: รับคำสั่งโอนงบจาก UI แล้วตรวจสิทธิ์ก่อนบันทึกหรือสร้างหนังสือ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getBudgets() {
  await requireUser();
  return listBudgets();
}
/* saveBudget: รับคำสั่งโอนงบจาก UI แล้วตรวจสิทธิ์ก่อนบันทึกหรือสร้างหนังสือ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function saveBudget(
  input: unknown,
  id?: string,
  version?: number,
) {
  await requireUser();
  try {
    if (id) {
      z.string().uuid().parse(id);
      z.number().int().positive().parse(version);
    }
    const data = saveBudgetRecord(input, id, version);
    revalidatePath("/");
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof z.ZodError
          ? e.issues[0].message
          : e instanceof Error
            ? e.message
            : "บันทึกไม่สำเร็จ",
    };
  }
}
/* deleteBudget: รับคำสั่งโอนงบจาก UI แล้วตรวจสิทธิ์ก่อนบันทึกหรือสร้างหนังสือ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function deleteBudget(id: string, version: number) {
  await requireUser();
  removeBudgetRecord(
    z.string().uuid().parse(id),
    z.number().int().positive().parse(version),
  );
  revalidatePath("/");
}
/* createBudgetMemo: รับคำสั่งโอนงบจาก UI แล้วตรวจสิทธิ์ก่อนบันทึกหรือสร้างหนังสือ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function createBudgetMemo(id: string, version: number) {
  await requireUser();
  const draft = generateBudgetDocument(
    z.string().uuid().parse(id),
    z.number().int().positive().parse(version),
  );
  revalidatePath("/");
  return draft;
}
