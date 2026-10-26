"use server";
/**
 * แผนที่อ่านโค้ด — src/app/backup-actions.ts
 * หน้าที่: ช่องทางจากหน้าจอไปยังรายการสำรองและการกู้เป็นโฟลเดอร์ใหม่
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../components/backup-manager.tsx
 * 2. ./backup-actions.ts ← คุณอยู่ที่นี่
 * 3. ../lib/backup-catalog.ts
 * 4. ../../scripts/restore-backup.mjs
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/backup-manager.tsx
 * อ่านต่อจาก import: ../lib/auth.ts, ../lib/backup-catalog.ts
 *
 * แนวทางแก้: เก็บการตรวจสิทธิ์และ parse ไว้ฝั่ง server เสมอ; การเพิ่มข้อมูลต้องให้ schema, UI และฐานข้อมูลใช้ชื่อเดียวกัน
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ../lib/auth.ts — ตรวจสถานะผู้ใช้และสร้าง cookie session; โหมดเครื่องส่วนตัวและโหมดทดลองมีเงื่อนไขข้ามล็อกอินเฉพาะของตน */
import { requireUser } from "@/lib/auth";
/* นำเข้า ../lib/backup-catalog.ts — ค้นชุดสำรองจากโฟลเดอร์ที่ระบบกำหนด และกู้สำเนาผ่านตัวกู้คืน */
import { backupCatalog, restoreCatalogBackup } from "@/lib/backup-catalog";
/* listBackups: ช่องทางจากหน้าจอไปยังรายการสำรองและการกู้เป็นโฟลเดอร์ใหม่ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function listBackups() {
  await requireUser();
  return backupCatalog();
}
/* restoreBackupCopy: ช่องทางจากหน้าจอไปยังรายการสำรองและการกู้เป็นโฟลเดอร์ใหม่ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export async function restoreBackupCopy(name: string) {
  await requireUser();
  return restoreCatalogBackup(name);
}
