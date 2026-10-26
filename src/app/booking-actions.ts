"use server";
/**
 * แผนที่อ่านโค้ด — src/app/booking-actions.ts
 * หน้าที่: ตรวจคำสั่งเพิ่มห้อง จอง และยกเลิก ก่อนส่งต่อ booking-db
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/booking.ts
 * 2. ../components/meeting-bookings.tsx
 * 3. ./booking-actions.ts ← คุณอยู่ที่นี่
 * 4. ../lib/booking-db.ts
 * 5. ../lib/db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/meeting-bookings.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/booking-db.ts
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
/* นำเข้า ../lib/booking-db.ts — เก็บห้องและการจอง มี transaction และ trigger ป้องกันการจองซ้อนถึงระดับ SQLite */
import {
  bookingSnapshot,
  saveRoom,
  saveBooking,
  cancelBooking,
} from "@/lib/booking-db";
const uuid = z.string().uuid(),
  versionSchema = z.number().int().positive();
const errorMessage = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues[0].message
    : e instanceof Error
      ? e.message
      : "ดำเนินการไม่สำเร็จ";
/* getBookings: ตรวจคำสั่งเพิ่มห้อง จอง และยกเลิก ก่อนส่งต่อ booking-db — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getBookings() {
  await requireUser();
  return bookingSnapshot();
}
/* writeRoom: ตรวจคำสั่งเพิ่มห้อง จอง และยกเลิก ก่อนส่งต่อ booking-db — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function writeRoom(input: unknown, id?: string, version?: number) {
  try {
    await requireUser();
    if (id) {
      uuid.parse(id);
      versionSchema.parse(version);
    }
    saveRoom(input, id, version);
    revalidatePath("/");
    return { ok: true as const, ...bookingSnapshot() };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
/* writeBooking: ตรวจคำสั่งเพิ่มห้อง จอง และยกเลิก ก่อนส่งต่อ booking-db — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function writeBooking(
  input: unknown,
  id?: string,
  version?: number,
) {
  try {
    await requireUser();
    if (id) {
      uuid.parse(id);
      versionSchema.parse(version);
    }
    saveBooking(input, id, version);
    revalidatePath("/");
    return { ok: true as const, ...bookingSnapshot() };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
/* cancelRoomBooking: ตรวจคำสั่งเพิ่มห้อง จอง และยกเลิก ก่อนส่งต่อ booking-db — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function cancelRoomBooking(
  id: string,
  version: number,
  reason: string,
) {
  try {
    await requireUser();
    cancelBooking(
      uuid.parse(id),
      versionSchema.parse(version),
      z.string().trim().min(1, "ระบุเหตุผลยกเลิก").max(1000).parse(reason),
    );
    revalidatePath("/");
    return { ok: true as const, ...bookingSnapshot() };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
