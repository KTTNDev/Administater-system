/**
 * แผนที่อ่านโค้ด — tests/action-search.test.ts
 * หน้าที่: กรณีทดสอบ action-search; อ่าน setup → การเรียกใช้งาน → expect เพื่อดูเงื่อนไขที่ระบบต้องรักษา
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../src/app/page.tsx
 * 2. ../src/components/workspace.tsx
 * 3. ../src/lib/document.ts
 * 4. ../src/app/actions.ts
 * 5. ../src/lib/db.ts
 * 6. ../src/lib/render-document.ts
 * 7. ../src/app/api/documents/[id]/pdf/route.ts
 * 8. ../src/lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ../src/lib/action-search.ts
 *
 * แนวทางแก้: เปลี่ยน expected เฉพาะเมื่อข้อกำหนดเปลี่ยนจริง อย่าแก้เพื่อให้ผ่านทั้งที่พฤติกรรมเสีย
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import { it, expect } from "vitest";
/* นำเข้า ../src/lib/action-search.ts — จัดอันดับทางลัดตามคำค้นด้วยกฎข้อความ ไม่ได้เรียกโมเดล AI */
import { searchWorkActions } from "../src/lib/action-search";
it("ranks Thai work requests and English synonyms", () => {
  for (const [query, id] of [
    ["อยากโอนงบซื้อคอม", "budget"],
    ["จองห้องประชุมพรุ่งนี้", "bookings"],
    ["นัดประชุมพร้อมแนบหนังสือ", "calendar"],
    ["อยากทำบันทึกข้อความ", "create-internal"],
    ["ช่วยกู้คืนข้อมูล", "backup"],
    ["upload ไม่ได้ อยาก sync Drive", "drive"],
  ])
    expect(searchWorkActions(query)[0]?.action.id, query).toBe(id);
});
it("returns related choices, empty state and bounded defaults", () => {
  expect(searchWorkActions("ประชุม").length).toBeGreaterThan(1);
  expect(searchWorkActions("ซื้อพิซซ่า")).toEqual([]);
  expect(searchWorkActions("   ")).toHaveLength(6);
  expect(searchWorkActions("DRIVE")[0].action.id).toBe("drive");
});
