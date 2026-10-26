"use server";
/**
 * แผนที่อ่านโค้ด — src/app/office-actions.ts
 * หน้าที่: รับคำสั่งรายการงานธุรการจากหน้าเว็บ ตรวจสิทธิ์แล้วเรียกฐานข้อมูล
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/office.ts
 * 2. ../components/office-workspace.tsx
 * 3. ./office-actions.ts ← คุณอยู่ที่นี่
 * 4. ../lib/office-db.ts
 * 5. ../lib/db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/office-workspace.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/office-db.ts
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
/* นำเข้า ../lib/office-db.ts — อ่านเขียนทะเบียนงานธุรการ ตรวจร่างหนังสืออ้างอิงและ version ก่อนแก้ไข */
import { listOffice, writeOffice, deleteOffice } from "@/lib/office-db";
/* getOfficeItems: รับคำสั่งรายการงานธุรการจากหน้าเว็บ ตรวจสิทธิ์แล้วเรียกฐานข้อมูล — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getOfficeItems() {
  await requireUser();
  return listOffice();
}
/* saveOfficeItem: รับคำสั่งรายการงานธุรการจากหน้าเว็บ ตรวจสิทธิ์แล้วเรียกฐานข้อมูล — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function saveOfficeItem(
  input: unknown,
  id?: string,
  version?: number,
) {
  try {
    await requireUser();
    if (id) {
      z.string().uuid().parse(id);
      z.number().int().positive().parse(version);
    }
    writeOffice(input, id, version);
    revalidatePath("/");
    return { ok: true as const, items: listOffice() };
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
/* removeOfficeItem: รับคำสั่งรายการงานธุรการจากหน้าเว็บ ตรวจสิทธิ์แล้วเรียกฐานข้อมูล — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function removeOfficeItem(id: string, version: number) {
  try {
    await requireUser();
    deleteOffice(
      z.string().uuid().parse(id),
      z.number().int().positive().parse(version),
    );
    revalidatePath("/");
    return { ok: true as const, items: listOffice() };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "ลบไม่สำเร็จ",
    };
  }
}
