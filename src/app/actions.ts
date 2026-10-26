"use server";
/**
 * แผนที่อ่านโค้ด — src/app/actions.ts
 * หน้าที่: จุดรับคำสั่งจากหน้าจอ: ตรวจสิทธิ์และข้อมูลก่อนบันทึก ลบ ทำสำเนา หรือส่งไป Drive
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./page.tsx
 * 2. ../components/workspace.tsx
 * 3. ../lib/document.ts
 * 4. ./actions.ts ← คุณอยู่ที่นี่
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ./api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./login/page.tsx, ../components/workspace.tsx
 * อ่านต่อจาก import: ../lib/document.ts, ../lib/auth.ts, ../lib/db.ts, ../lib/drive.ts, ../lib/attachments.ts, ../lib/appendix.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า next/cache — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { revalidatePath } from "next/cache";
/* นำเข้า next/headers — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { cookies } from "next/headers";
/* นำเข้า next/navigation — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import { redirect } from "next/navigation";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema, reviewIssues } from "@/lib/document";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser, validPassword, createSession } from "@/lib/auth";
/* นำเข้า ../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import {
  listDrafts,
  writeDraft,
  removeDraft,
  readDraft,
  auditHistory,
  getSetting,
  setSetting,
} from "@/lib/db";
/* นำเข้า ../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { syncToDrive } from "@/lib/drive";
/* นำเข้า ../lib/attachments.ts — รับ PDF/ภาพ ตรวจเนื้อไฟล์ เก็บต้นฉบับและฉบับสำหรับพิมพ์ แล้วรวมท้าย PDF ของหนังสือ */
import { validateAttachments } from "@/lib/attachments";
/* นำเข้า ../lib/appendix.ts — จัดเก็บภาพภาคผนวก ตรวจชนิด ขนาด และความตรงกันของข้อมูลภาพกับไฟล์จริง */
import { validateAppendixImages } from "@/lib/appendix";
const uuid = z.string().uuid();
const versionSchema = z.number().int().positive();
/* ขอบเขตความเชื่อถือ: input เป็น unknown จนผ่าน Zod; ตรวจไฟล์แนบและ review ก่อนเรียก writeDraft */
export async function saveDocument(
  input: unknown,
  id?: string,
  version?: number,
) {
  /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
  try {
    /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
    await requireUser();
    /* ตรวจ/แปลง draft จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
    const draft = documentSchema.parse(input);
    /* อย่าเชื่อ metadata ไฟล์จาก browser เพียงอย่างเดียว: ตรวจเทียบ id ขนาดและจำนวนหน้ากับไฟล์ในฐานข้อมูลก่อนบันทึก */
    validateAttachments(draft);
    validateAppendixImages(draft);
    /* id มีค่า = แก้ร่างเดิม จึงต้องมี version; id ไม่มีค่า = สร้างร่างใหม่ ให้ฐานข้อมูลสร้าง UUID */
    if (id) {
      uuid.parse(id);
      versionSchema.parse(version);
    }
    if (draft.status === "reviewed" && reviewIssues(draft).length)
      throw new Error(
        "ข้อมูลที่จำเป็นยังไม่ครบ: " + reviewIssues(draft).join(" · "),
      );
    const saved = writeDraft(draft, id, version);
    /* แจ้ง Next.js ว่าข้อมูลหน้าเปลี่ยนแล้ว เพื่อให้โหลดข้อมูล server รอบถัดไปตรงกับฐานข้อมูล */
    revalidatePath("/");
    /* as const ทำให้ ok มีชนิด literal true ไม่กว้างเป็น boolean; คู่กับกรณี ok:false ทำให้ผู้เรียก if(result.ok) แล้วเข้าถึง data/error ได้อย่างถูกชนิด */
    return { ok: true as const, data: saved };
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
/* อ่านร่างทั้งหมดหลังตรวจสิทธิ์ ใช้เติม dashboard หลังการบันทึก/ลบ */
export async function getDocuments() {
  /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
  await requireUser();
  return listDrafts();
}
/* ตรวจ UUID และ version แล้วลบผ่าน db; การมี version ช่วยไม่ลบร่างที่ถูกแก้จากหน้าต่างอื่น */
export async function deleteDocument(id: string, version: number) {
  /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
  try {
    /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
    await requireUser();
    removeDraft(uuid.parse(id), versionSchema.parse(version));
    /* แจ้ง Next.js ว่าข้อมูลหน้าเปลี่ยนแล้ว เพื่อให้โหลดข้อมูล server รอบถัดไปตรงกับฐานข้อมูล */
    revalidatePath("/");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "ลบไม่สำเร็จ",
    };
  }
}
/* อ่านร่างเดิม สร้าง id ใหม่ และล้างเลขที่/สถานะตรวจทานเพื่อให้ตรวจเอกสารสำเนาอีกครั้ง */
export async function duplicateDocument(id: string) {
  /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
  await requireUser();
  /* ตรวจ/แปลง d จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
  const d = readDraft(uuid.parse(id));
  return writeDraft({
    ...d,
    subject: d.subject + " (สำเนาร่าง)",
    number: "",
    status: "draft",
  });
}
/* คืนเหตุการณ์ย้อนหลังของเอกสารจาก audit; ใช้ดูว่าเกิดการสร้าง/แก้/ซิงก์เมื่อใด */
export async function getHistory(id: string) {
  /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
  await requireUser();
  return auditHistory(uuid.parse(id));
}
/* ส่ง id และ version ไป syncToDrive แล้วแจ้ง UI ว่าซิงก์ฉบับใดสำเร็จ */
export async function uploadDocument(id: string, version: number) {
  /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
  try {
    /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
    await requireUser();
    /* ตรวจ/แปลง result จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
    const result = await syncToDrive(
      uuid.parse(id),
      versionSchema.parse(version),
    );
    /* แจ้ง Next.js ว่าข้อมูลหน้าเปลี่ยนแล้ว เพื่อให้โหลดข้อมูล server รอบถัดไปตรงกับฐานข้อมูล */
    revalidatePath("/");
    return { ok: true as const, ...result };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ",
    };
  }
}
/* ตรวจข้อมูลหน่วยงานก่อนบันทึกใน settings; ค่าเหล่านี้ใช้เติมร่างใหม่ ไม่แก้ร่างเก่าอัตโนมัติ */
export async function saveOrganization(value: unknown) {
  /* ตรวจสิทธิ์ฝั่ง server ก่อนแตะข้อมูล; UI หรือ TypeScript type ใช้แทนการตรวจนี้ไม่ได้ */
  await requireUser();
  /* ตรวจ/แปลง data จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
  const data = z
    .object({
      name: z.string().min(1).max(200),
      department: z.string().max(200),
      address: z.string().max(1000),
      phone: z.string().max(100),
      prefix: z.string().max(100),
    })
    .parse(value);
  setSetting("organization", JSON.stringify(data));
  /* แจ้ง Next.js ว่าข้อมูลหน้าเปลี่ยนแล้ว เพื่อให้โหลดข้อมูล server รอบถัดไปตรงกับฐานข้อมูล */
  revalidatePath("/");
  return data;
}
/* ตรวจจำนวนครั้งที่ลองรหัสผ่านผิดและสร้าง session เมื่อผ่าน; อย่านำรหัสผ่านไปใส่ console หรือข้อความตอบกลับ */
export async function login(_previous: string, formData: FormData) {
  const key = "login-attempts";
  const now = Date.now();
  /* ตรวจ/แปลง attempts จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
  const attempts = JSON.parse(getSetting(key) || '{"count":0,"until":0}') as {
    count: number;
    until: number;
  };
  if (attempts.count >= 10 && attempts.until > now)
    return "ลองใหม่อีกครั้งหลังผ่านไป 15 นาที";
  const password = String(formData.get("password") || "");
  if (!validPassword(password)) {
    setSetting(
      key,
      JSON.stringify({
        count: attempts.until > now ? attempts.count + 1 : 1,
        until: attempts.until > now ? attempts.until : now + 900000,
      }),
    );
    return "รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งค่า APP_PASSWORD";
  }
  /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
  try {
    await createSession();
  } catch {
    return "กรุณาตั้งค่า SESSION_SECRET ก่อนใช้งาน";
  }
  setSetting(key, '{"count":0,"until":0}');
  redirect("/");
}
/* ลบ cookie session แล้วกลับหน้าล็อกอิน */
export async function logout() {
  (await cookies()).delete("sarabun-session");
  redirect("/login");
}
