/**
 * แผนที่อ่านโค้ด — tests/drive.test.ts
 * หน้าที่: กรณีทดสอบ drive; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/components/system-center.tsx
 * 2. ../src/app/storage-actions.ts
 * 3. ../src/lib/storage.ts
 * 4. ../src/lib/drive.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/db.ts, ../src/lib/document.ts, ../src/lib/drive.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:os — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import os from "node:os";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
const mocked = vi.hoisted(() => {
  const files = new Map<
    string,
    {
      id: string;
      name: string;
      mimeType?: string;
      parents?: string[];
      appProperties?: Record<string, string>;
      trashed?: boolean;
    }
  >();
  let sequence = 0;
  const api = {
    list: vi.fn(async ({ q }: { q: string }) => {
      if (q.includes("mimeType")) {
        const name = q.match(/name = '([^']+)'/)?.[1],
          parent = q.match(/'([^']+)' in parents/)?.[1];
        return {
          data: {
            files: [...files.values()].filter(
              (f) =>
                f.name === name && (!parent || f.parents?.includes(parent)),
            ),
          },
        };
      }
      const id = q.match(/key='documentId' and value='([^']+)'/)?.[1];
      return {
        data: {
          files: [...files.values()].filter(
            (f) => f.appProperties?.documentId === id,
          ),
        },
      };
    }),
    generateIds: vi.fn(async () => ({ data: { ids: [`fake-${++sequence}`] } })),
    get: vi.fn(async ({ fileId }: { fileId: string }) => {
      if (!files.has(fileId))
        throw Object.assign(new Error("not found"), { code: 404 });
      return { data: files.get(fileId)! };
    }),
    create: vi.fn(
      async ({
        requestBody,
      }: {
        requestBody: {
          id: string;
          name: string;
          mimeType?: string;
          parents?: string[];
          appProperties?: Record<string, string>;
        };
      }) => {
        files.set(requestBody.id, requestBody);
        return { data: requestBody };
      },
    ),
    update: vi.fn(
      async ({
        fileId,
        requestBody,
        addParents,
      }: {
        fileId: string;
        requestBody: { name: string; appProperties: Record<string, string> };
        addParents?: string;
      }) => {
        const f = files.get(fileId)!;
        Object.assign(
          f,
          requestBody,
          addParents ? { parents: [addParents] } : {},
        );
        return { data: f };
      },
    ),
  };
  return { files, api };
});
vi.mock("@googleapis/drive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@googleapis/drive")>()),
  drive: () => ({ files: mocked.api }),
}));
vi.mock("../src/lib/pdf", () => ({
  renderPdf: vi.fn(async () => Buffer.from("%PDF-1.7 TEST")),
}));
/* นำเข้า ../src/lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, writeDraft, readDraft, setSetting } from "../src/lib/db";
/* นำเข้า ../src/lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { newDraft } from "../src/lib/document";
/* นำเข้า ../src/lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import { encrypt, decrypt, syncToDrive } from "../src/lib/drive";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sarabun-drive-test-"));
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
  process.env.SESSION_SECRET =
    "unit-test-secret-at-least-thirty-two-characters";
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.APP_URL = "http://127.0.0.1:3000";
  setSetting("google:token", encrypt("test-refresh-token"));
  setSetting("google:account", "test-account");
});
afterAll(() => {
  db().close();
  fs.rmSync(dir, { recursive: true, force: true });
});
/* complete: กรณีทดสอบ drive; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
function complete() {
  return {
    ...newDraft(),
    date: "2026-10-01",
    subject: "ตัวอย่างทดสอบ",
    organization: "หน่วยงานทดสอบ",
    address: "ที่อยู่ทดสอบ",
    number: "ทส 1/1",
    recipient: "ผู้รับ",
    body: "เนื้อหา",
    signer: "ผู้ลงนาม",
    position: "ตำแหน่ง",
    status: "reviewed" as const,
  };
}
describe("Drive integration with mocked transport", () => {
  it("authenticates encrypted token data and rejects tampering", () => {
    const token = encrypt("sensitive-token");
    expect(token).not.toContain("sensitive-token");
    expect(decrypt(token)).toBe("sensitive-token");
    const bytes = Buffer.from(token, "base64");
    bytes[15] ^= 1;
    expect(() => decrypt(bytes.toString("base64"))).toThrow();
  });
  it("creates the fiscal hierarchy, uploads once and updates the same file", async () => {
    const d = writeDraft(complete());
    const first = await syncToDrive(d.id, d.version);
    expect(
      mocked.api.create.mock.calls.map((c) => c[0].requestBody.name),
    ).toEqual([
      "สารบรรณ",
      "หนังสือภายนอก",
      "ปีงบประมาณ 2570",
      "ทส 1-1_ตัวอย่างทดสอบ.pdf",
    ]);
    expect(readDraft(d.id).syncedVersion).toBe(1);
    const edited = writeDraft(
      { ...d, subject: "แก้ไขแล้ว", date: "2026-09-30" },
      d.id,
      1,
    );
    const second = await syncToDrive(d.id, edited.version);
    expect(second.fileId).toBe(first.fileId);
    expect(mocked.api.update).toHaveBeenCalledTimes(1);
    expect(readDraft(d.id).syncedVersion).toBe(2);
    expect(
      [...mocked.files.values()].some((f) => f.name === "ปีงบประมาณ 2569"),
    ).toBe(true);
  });
  it("rejects stale versions, unreviewed drafts and classified documents before uploading", async () => {
    const d = writeDraft(complete());
    const calls = mocked.api.create.mock.calls.length;
    await expect(syncToDrive(d.id, 99)).rejects.toThrow("เปลี่ยนแปลง");
    const classified = writeDraft({ ...complete(), confidentiality: "ลับ" });
    await expect(syncToDrive(classified.id, 1)).rejects.toThrow("หนังสือลับ");
    const unfinished = writeDraft(newDraft());
    await expect(syncToDrive(unfinished.id, 1)).rejects.toThrow("ตรวจทาน");
    expect(mocked.api.create.mock.calls.length).toBe(calls);
  });
});
