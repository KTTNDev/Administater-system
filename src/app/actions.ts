"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { documentSchema, reviewIssues } from "@/lib/document";
import { requireUser, validPassword, createSession } from "@/lib/auth";
import { listDrafts, writeDraft, removeDraft, readDraft, auditHistory, getSetting, setSetting } from "@/lib/db";
import { syncToDrive } from "@/lib/drive";
import { validateAttachments } from "@/lib/attachments";
const uuid = z.string().uuid();
const versionSchema = z.number().int().positive();
export async function saveDocument(input: unknown, id?: string, version?: number) {
  try {
    await requireUser(); const draft = documentSchema.parse(input);
    validateAttachments(draft);
    if (id) { uuid.parse(id); versionSchema.parse(version); }
    if (draft.status === "reviewed" && reviewIssues(draft).length) throw new Error("ข้อมูลที่จำเป็นยังไม่ครบ: " + reviewIssues(draft).join(" · "));
    const saved = writeDraft(draft,id,version); revalidatePath("/"); return {ok:true as const, data:saved};
  } catch (e) { return {ok:false as const,error:e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"}; }
}
export async function getDocuments() { await requireUser(); return listDrafts(); }
export async function deleteDocument(id: string, version: number) { try { await requireUser(); removeDraft(uuid.parse(id),versionSchema.parse(version)); revalidatePath("/"); return {ok:true as const}; } catch(e) { return {ok:false as const,error:e instanceof Error?e.message:"ลบไม่สำเร็จ"}; } }
export async function duplicateDocument(id: string) { await requireUser(); const d=readDraft(uuid.parse(id)); return writeDraft({...d,subject:d.subject+" (สำเนาร่าง)",number:"",status:"draft"}); }
export async function getHistory(id: string) { await requireUser(); return auditHistory(uuid.parse(id)); }
export async function uploadDocument(id: string, version: number) { try { await requireUser(); const result = await syncToDrive(uuid.parse(id),versionSchema.parse(version)); revalidatePath("/"); return {ok:true as const,...result}; } catch(e) { return {ok:false as const,error:e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ"}; } }
export async function saveOrganization(value: unknown) {
  await requireUser(); const data=z.object({name:z.string().min(1).max(200),department:z.string().max(200),address:z.string().max(1000),phone:z.string().max(100),prefix:z.string().max(100)}).parse(value);
  setSetting("organization",JSON.stringify(data)); revalidatePath("/"); return data;
}
export async function login(_previous: string, formData: FormData) {
  const key="login-attempts"; const now=Date.now(); const attempts=JSON.parse(getSetting(key)||'{"count":0,"until":0}') as {count:number;until:number};
  if(attempts.count>=10 && attempts.until>now) return "ลองใหม่อีกครั้งหลังผ่านไป 15 นาที";
  const password=String(formData.get("password")||"");
  if(!validPassword(password)) { setSetting(key,JSON.stringify({count:attempts.until>now?attempts.count+1:1,until:attempts.until>now?attempts.until:now+900000})); return "รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งค่า APP_PASSWORD"; }
  try { await createSession(); } catch { return "กรุณาตั้งค่า SESSION_SECRET ก่อนใช้งาน"; }
  setSetting(key,'{"count":0,"until":0}'); redirect("/");
}
export async function logout() { (await cookies()).delete("sarabun-session"); redirect("/login"); }
