/**
 * แผนที่อ่านโค้ด — src/lib/budget-db.ts
 * หน้าที่: เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./budget.ts
 * 2. ../components/budget-transfers.tsx
 * 3. ../app/budget-actions.ts
 * 4. ./budget-db.ts ← คุณอยู่ที่นี่
 * 5. ./budget-document.ts
 * 6. ./render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/budget-actions.ts, ../../tests/budget.test.ts
 * อ่านต่อจาก import: ./db.ts, ./budget.ts, ./budget-document.ts, ./document.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { randomUUID } from "node:crypto";
/* นำเข้า ./db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, readDraft } from "./db";
/* นำเข้า ./budget.ts — กฎคำขอโอนงบ รายการโอนลด/เพิ่ม การคำนวณยอด และการตรวจความครบถ้วน */
import { budgetSchema, budgetIssues, type BudgetRecord } from "./budget";
/* นำเข้า ./budget-document.ts — แปลงข้อมูลคำขอโอนงบเป็น Draft ของหนังสือภายในเพื่อใช้ตัวจัดหน้าเดิม */
import { budgetDraft } from "./budget-document";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentSchema } from "./document";
/* เตรียมตารางของโมดูลนี้บน connection กลางจาก db.ts แล้วคืนตัวเชื่อมพร้อมใช้ */
function connection() {
  const c = db();
  c.exec(
    "CREATE TABLE IF NOT EXISTS budget_transfers(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL,document_id TEXT,generated_version INTEGER)",
  );
  return c;
}
/* listBudgets: เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function listBudgets(): BudgetRecord[] {
  return connection()
    .prepare("SELECT * FROM budget_transfers ORDER BY updated_at DESC")
    .all()
    .map((r) => ({
      id: String(r.id),
      data: budgetSchema.parse(JSON.parse(String(r.data))),
      version: Number(r.version),
      updatedAt: String(r.updated_at),
      documentId: r.document_id ? String(r.document_id) : null,
    }));
}
/* saveBudgetRecord: เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function saveBudgetRecord(
  input: unknown,
  id?: string,
  version?: number,
) {
  const data = budgetSchema.parse(input),
    c = connection(),
    key = id || randomUUID(),
    now = new Date().toISOString();
  c.transaction(() => {
    if (id) {
      if (
        !c
          .prepare(
            "UPDATE budget_transfers SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .run(JSON.stringify(data), now, id, version ?? -1).changes
      )
        throw new Error("รายการเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด");
    } else
      c.prepare(
        "INSERT INTO budget_transfers(id,data,version,updated_at) VALUES(?,?,1,?)",
      ).run(key, JSON.stringify(data), now);
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(key, "budget_save", id ? (version || 0) + 1 : 1, now);
  })();
  return listBudgets().find((r) => r.id === key)!;
}
/* removeBudgetRecord: เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function removeBudgetRecord(id: string, version: number) {
  const c = connection();
  c.transaction(() => {
    if (
      !c
        .prepare("DELETE FROM budget_transfers WHERE id=? AND version=?")
        .run(id, version).changes
    )
      throw new Error("รายการเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด");
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(id, "budget_delete", version, new Date().toISOString());
  })();
}
/* generateBudgetDocument: เก็บคำขอโอนงบ ตรวจ version และสร้างร่างบันทึกข้อความจากคำขอ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function generateBudgetDocument(id: string, version: number) {
  const c = connection();
  return c.transaction(() => {
    const row = c
      .prepare("SELECT * FROM budget_transfers WHERE id=? AND version=?")
      .get(id, version);
    if (!row) throw new Error("รายการเปลี่ยนแล้ว กรุณาบันทึกข้อมูลล่าสุด");
    if (
      row.document_id &&
      row.generated_version === version &&
      c.prepare("SELECT id FROM documents WHERE id=?").get(row.document_id)
    )
      return readDraft(String(row.document_id));
    const b = budgetSchema.parse(JSON.parse(String(row.data))),
      issues = budgetIssues(b);
    if (issues.length) throw new Error(issues.join(" · "));
    const draft = documentSchema.parse(budgetDraft(b)),
      key = randomUUID(),
      now = new Date().toISOString();
    c.prepare(
      "INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)",
    ).run(key, JSON.stringify(draft), now, now);
    c.prepare(
      "UPDATE budget_transfers SET document_id=?,generated_version=? WHERE id=?",
    ).run(key, version, id);
    c.prepare(
      "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
    ).run(key, "budget_document_create", 1, now);
    return readDraft(key);
  })();
}
