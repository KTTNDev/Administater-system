/**
 * แผนที่อ่านโค้ด — src/lib/recovery.ts
 * หน้าที่: เก็บร่างกู้คืนของฟอร์ม แยกจากเอกสารที่ผู้ใช้กดบันทึกจริง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/recovery-panel.tsx
 * 2. ../app/recovery-actions.ts
 * 3. ./recovery.ts ← คุณอยู่ที่นี่
 * 4. ./document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/recovery-actions.ts, ../../tests/recovery.test.ts
 * อ่านต่อจาก import: ./db.ts, ./document.ts, ./budget.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า zod — Zod ตรวจข้อมูลจริงขณะรัน ต่างจาก type ที่ถูกลบทิ้งตอน compile */
import { z } from "zod";
/* นำเข้า ./db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db } from "./db";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema } from "./document";
/* นำเข้า ./budget.ts — กฎคำขอโอนงบ รายการโอนลด/เพิ่ม การคำนวณยอด และการตรวจความครบถ้วน */
import { budgetSchema } from "./budget";
export const recoveryScope = z.enum(["document", "budget"]);
/* ชนิด RecoveryScope: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime; z.infer สร้าง type จาก Zod schema จึงไม่ต้องเขียนชื่อช่องซ้ำสองชุด */
export type RecoveryScope = z.infer<typeof recoveryScope>;
const envelope = z.object({
  id: z.string().uuid(),
  scope: recoveryScope,
  sequence: z.number().int().positive(),
  data: z.unknown(),
});
/* เตรียมตารางของโมดูลนี้บน connection กลางจาก db.ts แล้วคืนตัวเชื่อมพร้อมใช้ */
function connection() {
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS recovery_drafts(id TEXT PRIMARY KEY,scope TEXT NOT NULL,sequence INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  return c;
}
/* parse: เก็บร่างกู้คืนของฟอร์ม แยกจากเอกสารที่ผู้ใช้กดบันทึกจริง — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function parse(scope: RecoveryScope, data: unknown) {
  return scope === "document"
    ? documentSchema.extend({ subject: z.string().max(300) }).parse(data)
    : budgetSchema.extend({ title: z.string().max(200) }).parse(data);
}
/* บันทึกสำเนาร่างชั่วคราวสำหรับกู้ข้อความ แยกจากการบันทึกเอกสารจริง */
export function storeRecovery(input: unknown) {
  const r = envelope.parse(input),
    data = parse(r.scope, r.data),
    c = connection();
  const at = new Date().toISOString();
  c.prepare(
    "INSERT INTO recovery_drafts(id,scope,sequence,data,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sequence=excluded.sequence,data=excluded.data,updated_at=excluded.updated_at WHERE excluded.sequence>recovery_drafts.sequence AND excluded.scope=recovery_drafts.scope",
  ).run(r.id, r.scope, r.sequence, JSON.stringify(data), at);
  return { at };
}
/* อ่านรายการร่างกู้คืนให้ผู้ใช้เลือก โดยไม่เขียนทับร่างที่กำลังเปิด */
export function listRecovery(scope: RecoveryScope) {
  return connection()
    .prepare(
      "SELECT id,data,updated_at FROM recovery_drafts WHERE scope=? ORDER BY updated_at DESC LIMIT 30",
    )
    .all(recoveryScope.parse(scope))
    .map((r) => {
      const data = JSON.parse(String(r.data));
      return {
        id: String(r.id),
        title: String(data.subject || data.title || "ร่างยังไม่ระบุเรื่อง"),
        at: String(r.updated_at),
      };
    });
}
/* อ่านข้อมูลกู้คืนรายการที่เลือกแล้วตรวจรูปแบบก่อนส่งกลับฟอร์ม */
export function readRecovery(id: string, scope: RecoveryScope) {
  const r = connection()
    .prepare("SELECT data FROM recovery_drafts WHERE id=? AND scope=?")
    .get(z.string().uuid().parse(id), recoveryScope.parse(scope));
  if (!r) throw new Error("ไม่พบสำเนากู้คืน");
  return parse(scope, JSON.parse(String(r.data)));
}
