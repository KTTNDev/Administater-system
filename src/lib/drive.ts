/**
 * แผนที่อ่านโค้ด — src/lib/drive.ts
 * หน้าที่: Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/system-center.tsx
 * 2. ../app/storage-actions.ts
 * 3. ./storage.ts
 * 4. ./drive.ts ← คุณอยู่ที่นี่
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/actions.ts, ../app/api/google/callback/route.ts, ../app/api/google/connect/route.ts, ../app/legal-actions.ts, ../app/page.tsx, ../app/setup-actions.ts, ../app/storage-actions.ts, ../../tests/drive.test.ts
 * อ่านต่อจาก import: ./storage.ts, ./auth.ts, ./db.ts, ./document.ts, ./templates.ts, ./pdf.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า ./storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import { storageConfig } from "./storage";
/* นำเข้า server-only — กันการนำไฟล์ที่ใช้ฐานข้อมูล/ความลับไป bundle ใน browser */
import "server-only";
import { drive as createDrive, auth as googleAuth } from "@googleapis/drive";
/* นำเข้า node:crypto — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
/* นำเข้า node:stream — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import { Readable } from "node:stream";
/* นำเข้า ./auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { secret } from "./auth";
/* นำเข้า ./db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { db, getSetting, setSetting, readDraft } from "./db";
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import { documentYear, reviewIssues } from "./document";
/* นำเข้า ./templates.ts — ทะเบียนประเภทหนังสือ หมวด ชื่อ คำแนะนำ และข้อมูลหน่วยงานตัวอย่าง */
import { template } from "./templates";
/* นำเข้า ./pdf.ts — เปิด HTML เอกสารด้วย Chromium แบบไม่แสดงหน้าต่าง รอจัดหน้า แล้วรวมไฟล์แนบเป็น PDF */
import { renderPdf } from "./pdf";
/* สร้าง OAuth client จาก environment และ callback URL; ไม่ฝังคีย์ของเครื่องลง Git */
export function oauthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw new Error("กรุณาตั้งค่า Google OAuth ใน .env.local ก่อนเชื่อมต่อ");
  const origin = process.env.APP_URL;
  if (!origin) throw new Error("กรุณาตั้งค่า APP_URL");
  secret();
  return new googleAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/google/callback`,
  );
}
/* เข้ารหัส token ด้วย AES-GCM พร้อม IV สุ่ม; ต้องเก็บ SESSION_SECRET เดิมไว้เพื่อถอดรหัสในครั้งถัดไป */
export function encrypt(value: string) {
  const iv = randomBytes(12),
    key = createHash("sha256").update(secret()).digest(),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
/* ตรวจและถอดรหัส token ที่บันทึกไว้; เปลี่ยน secret แล้ว token เดิมจะอ่านไม่ได้ */
export function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64"),
    key = createHash("sha256").update(secret()).digest(),
    cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
/* คืนเฉพาะสถานะการเชื่อมต่อและอีเมลให้หน้าเว็บ ไม่คืน token */
export function driveStatus() {
  return {
    configured: !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.SESSION_SECRET
    ),
    connected: !!getSetting("google:token"),
    email: getSetting("google:email") || "",
  };
}
export const escapeDriveQuery = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
/* เตรียม Drive client ด้วย credential ที่จัดเก็บไว้สำหรับการเรียก API */
async function driveClient() {
  const auth = oauthClient(),
    stored = getSetting("google:token");
  if (!stored)
    throw new Error(
      "ยังไม่ได้เชื่อมต่อ Google Drive ไปที่ตั้งค่าเพื่อเชื่อมต่อบัญชี",
    );
  auth.setCredentials({ refresh_token: decrypt(stored) });
  return createDrive({ version: "v3", auth });
}
/* ชนิด DriveClient: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type DriveClient = Awaited<ReturnType<typeof driveClient>>;
/* หา/สร้างโฟลเดอร์ Drive ที่ระบบต้องใช้ ลดการสร้างหมวดซ้ำเมื่อซิงก์อีกครั้ง */
async function ensureFolder(
  drive: DriveClient,
  name: string,
  parent?: string,
): Promise<string> {
  const parentQuery = parent
    ? ` and '${escapeDriveQuery(parent)}' in parents`
    : "";
  // Reuse an existing folder with the same name under the configured parent.
  // This also adopts folders prepared by an administrator or the Drive connector.
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escapeDriveQuery(name)}'${parentQuery}`;
  const result = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 1,
  });
  if (result.data.files?.[0]?.id) return result.data.files[0].id;
  // Reserve IDs before create. Retrying after a lost response reuses the same ID.
  const cacheKey = `drive:folder:${parent || "root"}:${name}`;
  let id = getSetting(cacheKey);
  if (id) {
    try {
      const f = await drive.files.get({ fileId: id, fields: "id,trashed" });
      if (!f.data.trashed) return id;
      id = undefined;
    } catch (e) {
      if ((e as { code?: number }).code !== 404) throw e;
    }
  }
  if (!id) {
    id = (await drive.files.generateIds({ count: 1 })).data.ids?.[0];
    if (!id) throw new Error("สร้างรหัสโฟลเดอร์ไม่สำเร็จ");
    setSetting(cacheKey, id);
  }
  await drive.files.create({
    requestBody: {
      id,
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parent ? [parent] : undefined,
      appProperties: { application: "sarabun" },
    },
    fields: "id",
  });
  return id;
}
const shared = globalThis as unknown as { sarabunSyncQueue?: Promise<unknown> };
/* อ่านฉบับปัจจุบัน ตรวจเงื่อนไขและ version แล้วสร้าง PDF/อัปเดตไฟล์บน Drive */
export async function syncToDrive(id: string, expectedVersion: number) {
  const run = async () => {
    const d = readDraft(id);
    if (d.version !== expectedVersion)
      throw new Error("ร่างเปลี่ยนแปลงแล้ว กรุณาบันทึกและลองใหม่");
    if (d.confidentiality !== "ปกติ")
      throw new Error("รุ่นนี้ยังไม่รองรับการเก็บหนังสือลับบน Google Drive");
    if (d.status !== "reviewed" || reviewIssues(d).length)
      throw new Error(
        "กรุณากรอกข้อมูลให้ครบและทำเครื่องหมายตรวจทานก่อนอัปโหลด",
      );
    const pdf = await renderPdf(d),
      drive = await driveClient();
    const configuredParent = storageConfig().driveRoot.trim();
    const root = configuredParent || (await ensureFolder(drive, "สารบรรณ"));
    const typeFolder = await ensureFolder(drive, template(d.type).name, root);
    const yearName = `${d.yearMode === "fiscal" ? "ปีงบประมาณ" : "ปีปฏิทิน"} ${documentYear(d.date, d.yearMode)}`;
    const folder = await ensureFolder(drive, yearName, typeFolder);
    const name =
      `${d.number || "ไม่มีเลขที่"}_${d.subject}`
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
        .slice(0, 160) + ".pdf";
    const result = await drive.files.list({
      q: `trashed=false and appProperties has { key='documentId' and value='${escapeDriveQuery(id)}' } and appProperties has { key='application' and value='sarabun' }`,
      fields: "files(id,parents)",
      pageSize: 1,
    });
    let fileId = result.data.files?.[0]?.id || d.driveFileId || undefined;
    const metadata = {
      name,
      appProperties: {
        application: "sarabun",
        documentId: id,
        version: String(d.version),
      },
    };
    if (fileId) {
      try {
        const matched =
          result.data.files?.[0]?.id === fileId
            ? result.data.files[0]
            : undefined;
        const parents =
          matched?.parents ||
          (await drive.files.get({ fileId, fields: "parents,trashed" })).data
            .parents ||
          [];
        await drive.files.update({
          fileId,
          requestBody: metadata,
          addParents: parents.includes(folder) ? undefined : folder,
          removeParents:
            parents.filter((p) => p !== folder).join(",") || undefined,
          media: { mimeType: "application/pdf", body: Readable.from(pdf) },
          fields: "id",
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 404) throw error;
        fileId = undefined;
      }
    }
    if (!fileId) {
      const key = `drive:file:${getSetting("google:account")}:${id}`;
      fileId = getSetting(key);
      if (!fileId) {
        fileId = (await drive.files.generateIds({ count: 1 })).data.ids?.[0];
        if (!fileId) throw new Error("สร้างรหัสไฟล์ไม่สำเร็จ");
        setSetting(key, fileId);
      }
      await drive.files.create({
        requestBody: { ...metadata, id: fileId, parents: [folder] },
        media: { mimeType: "application/pdf", body: Readable.from(pdf) },
        fields: "id",
      });
    }
    // Snapshot version is recorded even if the draft changed during upload.
    db()
      .prepare(
        "UPDATE documents SET drive_file_id=?,synced_version=? WHERE id=?",
      )
      .run(fileId, d.version, id);
    db()
      .prepare(
        "INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)",
      )
      .run(id, "drive_upload", d.version, new Date().toISOString());
    return {
      fileId,
      url: `https://drive.google.com/file/d/${fileId}/view`,
      version: d.version,
    };
  };
  const pending = (shared.sarabunSyncQueue || Promise.resolve()).then(run, run);
  shared.sarabunSyncQueue = pending.catch(() => {});
  return pending;
}

// Preserve each uploaded edition; retries reuse the same reserved file ID.
/* ส่ง PDF ในคลังระเบียบไป Drive และเก็บรหัสไฟล์สำหรับอ้างกลับ */
export async function uploadLibraryPdf(input: {
  id: string;
  hash: string;
  title: string;
  category: string;
  year: string;
  bytes: Buffer;
}) {
  const run = async () => {
    const drive = await driveClient(),
      root =
        storageConfig().driveRoot.trim() ||
        (await ensureFolder(drive, "สารบรรณ"));
    const library = await ensureFolder(drive, "คลังกฎหมายและระเบียบ", root),
      category = await ensureFolder(drive, input.category, library),
      folder = await ensureFolder(
        drive,
        input.year ? `พ.ศ. ${input.year}` : "ไม่ระบุปี",
        category,
      );
    const key = `drive:legal:${getSetting("google:account")}:${input.id}:${input.hash}`;
    let id = getSetting(key);
    if (id) {
      try {
        const existing = await drive.files.get({
          fileId: id,
          fields: "id,trashed",
        });
        if (!existing.data.trashed) return id;
        id = undefined;
      } catch (e) {
        if ((e as { code?: number }).code !== 404) throw e;
      }
    }
    if (!id) {
      id = (await drive.files.generateIds({ count: 1 })).data.ids?.[0];
      if (!id) throw new Error("สร้างรหัสไฟล์ไม่สำเร็จ");
      setSetting(key, id);
    }
    const name =
      input.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").slice(0, 150) + ".pdf";
    await drive.files.create({
      requestBody: {
        id,
        name,
        parents: [folder],
        appProperties: {
          application: "sarabun",
          legalId: input.id,
          hash: input.hash,
        },
      },
      media: { mimeType: "application/pdf", body: Readable.from(input.bytes) },
      fields: "id",
    });
    return id;
  };
  const pending = (shared.sarabunSyncQueue || Promise.resolve()).then(run, run);
  shared.sarabunSyncQueue = pending.catch(() => {});
  return pending;
}
/* ตรวจโฟลเดอร์ปลายทางและสิทธิ์ที่ API อนุญาตให้อ่าน ก่อนส่งไฟล์ไปเก็บ */
export async function verifyDriveFolder(id: string, privateOnly: boolean) {
  if (!id || !/^[\w-]{10,200}$/.test(id))
    throw new Error("กรุณาระบุโฟลเดอร์ Drive ในตั้งค่า");
  const drive = await driveClient();
  try {
    const { data } = await drive.files.get({
      fileId: id,
      fields:
        "id,name,mimeType,trashed,capabilities(canAddChildren),permissions(type,role)",
      supportsAllDrives: true,
    });
    if (
      data.trashed ||
      data.mimeType !== "application/vnd.google-apps.folder" ||
      !data.capabilities?.canAddChildren
    )
      throw new Error(
        "โฟลเดอร์ไม่พร้อมใช้งาน หรือบัญชีนี้ไม่มีสิทธิ์เพิ่มไฟล์",
      );
    const publicAccess = data.permissions
      ? data.permissions.some((p) => p.type === "anyone" || p.type === "domain")
      : null;
    if (privateOnly && publicAccess === true)
      throw new Error(
        "การสำรองข้อมูลงานต้องใช้โฟลเดอร์ที่ไม่เปิดแก่ทุกคน/ทั้งโดเมน กรุณาตั้งโฟลเดอร์สำรองส่วนตัว",
      );
    return { id: data.id!, name: data.name || "Google Drive", publicAccess };
  } catch (error) {
    const e = error as { code?: number; response?: { status?: number } };
    if (e.code !== 404 && e.response?.status !== 404) throw error;
  }
  // With the drive.file OAuth scope, Google can hide a user-created folder from
  // metadata reads even when the user granted the app access to write into it.
  // Prove write access using an empty, clearly named probe and remove it at once.
  const name = `SARABUN_WRITE_ACCESS_TEST_${randomBytes(8).toString("hex")}.txt`;
  const probe = await drive.files.create({
    requestBody: {
      name,
      mimeType: "text/plain",
      parents: [id],
      appProperties: {
        application: "sarabun",
        purpose: "temporary-drive-write-check",
      },
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from(["Temporary Drive write-access check."]),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const probeId = probe.data.id;
  if (!probeId)
    throw new Error(
      "Drive รับไฟล์ทดสอบแล้วแต่ไม่ส่งรหัสไฟล์กลับมา กรุณาตรวจโฟลเดอร์ Drive",
    );
  try {
    await drive.files.delete({ fileId: probeId, supportsAllDrives: true });
  } catch {
    throw new Error(
      `อัปโหลดทดสอบได้ แต่ลบไฟล์ทดสอบไม่สำเร็จ กรุณาลบ ${name} ในโฟลเดอร์ Drive ด้วยตนเอง`,
    );
  }
  return { id, name: "โฟลเดอร์ Drive ที่กำหนด", publicAccess: null };
}
/* ส่งไฟล์สำรองโดยใช้ hash และข้อมูลชุดสำรองช่วยตรวจการอัปโหลดซ้ำ */
export async function uploadBackupFile(
  file: string,
  root: string,
  batch: string,
  rootVerified = false,
) {
  if (!rootVerified) await verifyDriveFolder(root, true);
  const drive = await driveClient(),
    backupRoot = await ensureFolder(drive, "สำรองข้อมูลระบบ", root),
    folder = await ensureFolder(drive, batch, backupRoot);
  const bytes = fs.readFileSync(file),
    hash = createHash("sha256").update(bytes).digest("hex"),
    key = `drive:backup:${getSetting("google:account")}:${root}:${batch}:${path.basename(file)}:${hash}`;
  let id = getSetting(key);
  if (id) {
    try {
      const f = await drive.files.get({ fileId: id, fields: "id,trashed" });
      if (!f.data.trashed) return id;
      id = undefined;
    } catch (e) {
      if ((e as { code?: number }).code !== 404) throw e;
    }
  }
  if (!id) {
    id = (await drive.files.generateIds({ count: 1 })).data.ids?.[0];
    if (!id) throw new Error("สร้างรหัสไฟล์ไม่สำเร็จ");
    setSetting(key, id);
  }
  await drive.files.create({
    requestBody: {
      id,
      name: path.basename(file),
      parents: [folder],
      appProperties: { application: "sarabun", hash },
    },
    media: {
      mimeType: file.endsWith(".pdf") ? "application/pdf" : "application/json",
      body: Readable.from(bytes),
    },
    fields: "id",
  });
  return id;
}
