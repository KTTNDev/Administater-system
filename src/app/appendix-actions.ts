"use server";
/**
 * แผนที่อ่านโค้ด — src/app/appendix-actions.ts
 * หน้าที่: รับภาพภาคผนวกและส่ง data URL กลับให้หน้าจอหลังตรวจสิทธิ์
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ../components/appendix-editor.tsx
 * 3. ./appendix-actions.ts ← คุณอยู่ที่นี่
 * 4. ../lib/appendix.ts
 * 5. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/appendix-editor.tsx, ../components/workspace.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/appendix.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/appendix.ts — จัดเก็บภาพภาคผนวก ตรวจชนิด ขนาด และความตรงกันของข้อมูลภาพกับไฟล์จริง */
import { createAppendixImage, readAppendixImage } from "@/lib/appendix";

/* uploadAppendixImage: รับภาพภาคผนวกและส่ง data URL กลับให้หน้าจอหลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function uploadAppendixImage(form: FormData) {
  await requireUser();
  try {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("กรุณาเลือกรูปภาพ");
    return { ok: true as const, data: await createAppendixImage(file) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "อัปโหลดรูปภาพไม่สำเร็จ",
    };
  }
}
/* getAppendixImageSources: รับภาพภาคผนวกและส่ง data URL กลับให้หน้าจอหลังตรวจสิทธิ์ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getAppendixImageSources(ids: string[]) {
  await requireUser();
  const valid = z.array(z.string().uuid()).max(20).parse(ids);
  return Object.fromEntries(
    valid.map((id) => {
      const item = readAppendixImage(id);
      return [
        id,
        `data:${item.mime};base64,${Buffer.from(item.file).toString("base64")}`,
      ];
    }),
  );
}
