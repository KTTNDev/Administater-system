"use server";
/**
 * แผนที่อ่านโค้ด — src/app/storage-actions.ts
 * หน้าที่: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/system-center.tsx
 * 2. ./storage-actions.ts ← คุณอยู่ที่นี่
 * 3. ../lib/storage.ts
 * 4. ../lib/drive.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/system-center.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/storage.ts, ./legal-actions.ts, ../lib/db.ts, ../lib/drive.ts, ../lib/pdf.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า node:fs — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import fs from "node:fs";
/* นำเข้า node:path — API ของ Node.js ใช้ใน server/เครื่องผู้รัน ไม่ใช้ตรง ๆ ใน browser */
import path from "node:path";
/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/storage.ts — ตำแหน่งเก็บข้อมูลในเครื่อง ส่งออกชุดสำรอง และรวบรวมข้อมูลสำหรับรายงาน */
import {
  storageConfig,
  setStorage,
  exportWorkspace,
  reportData,
} from "@/lib/storage";
/* นำเข้า ./legal-actions.ts — CRUD คลังระเบียบ พร้อมไฟล์ PDF และการซิงก์ขึ้น Drive หลังตรวจสิทธิ์ */
import { listLegalReferences, uploadLegalReference } from "./legal-actions";
/* นำเข้า ../lib/db.ts — ตัวเชื่อม SQLite และการบันทึกร่างแบบตรวจ version ป้องกันหน้าต่างหนึ่งเขียนทับอีกหน้าต่าง */
import { listDrafts } from "@/lib/db";
/* นำเข้า ../lib/drive.ts — Google Drive OAuth การเข้ารหัส token การสร้างโฟลเดอร์ และซิงก์ PDF/ไฟล์สำรอง */
import {
  syncToDrive,
  verifyDriveFolder,
  uploadBackupFile,
  driveStatus,
} from "@/lib/drive";
/* getStorage: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getStorage() {
  await requireUser();
  return { ...storageConfig(), drive: driveStatus() };
}
/* saveStorage: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function saveStorage(local: string, root: string, backup: string) {
  await requireUser();
  const id = (v: string) => v.match(/\/folders\/([\w-]+)/)?.[1] || v.trim();
  return setStorage(local, id(root), id(backup));
}
/* exportLocal: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function exportLocal() {
  await requireUser();
  return exportWorkspace();
}
/* getReports: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function getReports() {
  await requireUser();
  return reportData();
}
/* checkDrive: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function checkDrive() {
  await requireUser();
  return verifyDriveFolder(storageConfig().driveRoot, false);
}
/* syncWorkspace: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function syncWorkspace() {
  await requireUser();
  const config = storageConfig();
  const folder = await verifyDriveFolder(config.driveRoot, false);
  const backupRoot = config.backupRoot || config.driveRoot;
  const backupFolder =
    backupRoot === config.driveRoot
      ? folder
      : await verifyDriveFolder(backupRoot, false);
  const result: { name: string; ok: boolean; message: string }[] = [];
  for (const d of listDrafts().filter(
    (d) =>
      d.status === "reviewed" &&
      d.confidentiality === "ปกติ" &&
      d.syncedVersion !== d.version,
  )) {
    try {
      await syncToDrive(d.id, d.version);
      result.push({ name: d.subject, ok: true, message: "PDF อัปโหลดแล้ว" });
    } catch (e) {
      result.push({
        name: d.subject,
        ok: false,
        message: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ",
      });
    }
  }
  for (const law of (await listLegalReferences()).filter(
    (x) => x.fileName && !x.driveFileId,
  )) {
    try {
      await uploadLegalReference(law.id);
      result.push({ name: law.title, ok: true, message: "อัปโหลด PDF แล้ว" });
    } catch (e) {
      result.push({
        name: law.title,
        ok: false,
        message: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ",
      });
    }
  }
  const backup = exportWorkspace();
  for (const file of fs.readdirSync(backup.folder)) {
    try {
      if (backupFolder.publicAccess === true)
        throw new Error(
          "โฟลเดอร์สำรองเปิดให้สาธารณะเข้าถึง กรุณาเลือกโฟลเดอร์ส่วนตัว",
        );
      await uploadBackupFile(
        path.join(backup.folder, file),
        backupRoot,
        path.basename(backup.folder),
        true,
      );
      result.push({ name: file, ok: true, message: "สำรองแล้ว" });
    } catch (e) {
      result.push({
        name: file,
        ok: false,
        message: e instanceof Error ? e.message : "สำรองไม่สำเร็จ",
      });
    }
  }
  return {
    result,
    localFolder: backup.folder,
    permissionsVerified: backupFolder.publicAccess === false,
  };
}

/* exportDocumentPdfs: คำสั่งตั้งค่าที่เก็บ ส่งออกข้อมูล และซิงก์จากหน้าระบบไปยังบริการจัดเก็บ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function exportDocumentPdfs() {
  await requireUser();
  const { renderPdf } = await import("@/lib/pdf");
  const { storeDocumentPdf } = await import("@/lib/storage");
  const result: { name: string; ok: boolean; message: string }[] = [];
  for (const d of listDrafts()) {
    try {
      const file = storeDocumentPdf(d, await renderPdf(d));
      result.push({ name: d.subject, ok: true, message: file });
    } catch (e) {
      result.push({
        name: d.subject,
        ok: false,
        message: e instanceof Error ? e.message : "สร้าง PDF ไม่สำเร็จ",
      });
    }
  }
  return result;
}
