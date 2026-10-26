/**
 * แผนที่อ่านโค้ด — src/lib/booking.ts
 * หน้าที่: กฎการจองห้อง ช่วงเวลา ความจุ และตัวช่วยวันที่/ตรวจช่วงเวลาทับกัน
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./booking.ts ← คุณอยู่ที่นี่
 * 2. ../components/meeting-bookings.tsx
 * 3. ../app/booking-actions.ts
 * 4. ./booking-db.ts
 * 5. ./db.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/meeting-bookings.tsx, ../components/work-calendar.tsx, ../components/workspace.tsx, ./booking-db.ts, ../../tests/booking.test.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่")
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      !isNaN(+parsed) &&
      parsed.toISOString().slice(0, 10) === value &&
      +value.slice(0, 4) >= 1900 &&
      +value.slice(0, 4) < 2200
    );
  }, "วันที่ไม่ถูกต้อง");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "เวลาไม่ถูกต้อง");
const short = z.string().trim().max(300).default("");
export const roomSchema = z.object({
  name: z.string().trim().min(1, "ระบุชื่อห้อง").max(120),
  location: short,
  capacity: z.number().int().min(1).max(10000),
  equipment: z.string().max(2000).default(""),
  bufferMinutes: z.number().int().min(0).max(120).default(15),
  active: z.boolean().default(true),
});
/* ชนิด RoomInput: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type RoomInput = z.infer<typeof roomSchema>;
/* ชนิด Room: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type Room = RoomInput & { id: string; version: number };
export const bookingSchema = z
  .object({
    roomId: z.string().uuid(),
    title: z.string().trim().min(1, "ระบุหัวข้อการประชุม").max(300),
    organizer: z.string().trim().min(1, "ระบุผู้จอง / ผู้ประสานงาน").max(200),
    department: short,
    contact: short,
    date,
    start: time,
    end: time,
    attendees: z.number().int().min(1).max(10000),
    documentId: z.union([z.literal(""), z.string().uuid()]).default(""),
    notes: z.string().max(10000).default(""),
  })
  .refine((value) => value.end > value.start, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่มในวันเดียวกัน",
    path: ["end"],
  });
/* ชนิด BookingInput: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type BookingInput = z.infer<typeof bookingSchema>;
/* ชนิด Booking: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type Booking = BookingInput & {
  id: string;
  version: number;
  status: "booked" | "cancelled";
  bufferMinutes: number;
  cancellationReason: string;
  updatedAt: string;
};
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
/* clashes: กฎการจองห้อง ช่วงเวลา ความจุ และตัวช่วยวันที่/ตรวจช่วงเวลาทับกัน */
export function clashes(
  bookings: Booking[],
  roomId: string,
  date: string,
  start: string,
  end: string,
  buffer: number,
  exceptId?: string,
) {
  return bookings.filter(
    (b) =>
      b.id !== exceptId &&
      b.status === "booked" &&
      b.roomId === roomId &&
      b.date === date &&
      minutes(b.start) < minutes(end) + buffer &&
      minutes(b.end) + b.bufferMinutes > minutes(start),
  );
}
/* shiftDate: กฎการจองห้อง ช่วงเวลา ความจุ และตัวช่วยวันที่/ตรวจช่วงเวลาทับกัน */
export function shiftDate(value: string, days: number) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
