"use client";
/**
 * แผนที่อ่านโค้ด — src/components/backup-manager.tsx
 * หน้าที่: หน้าจอเลือกชุดสำรองและกู้เป็นสำเนา แสดงผลการทำงานให้ผู้ใช้
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./backup-manager.tsx ← คุณอยู่ที่นี่
 * 2. ../app/backup-actions.ts
 * 3. ../lib/backup-catalog.ts
 * 4. ../../scripts/restore-backup.mjs
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./system-center.tsx
 * อ่านต่อจาก import: ../app/backup-actions.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useState, useTransition } from "react";
/* นำเข้า ../app/backup-actions.ts — ช่องทางจากหน้าจอไปยังรายการสำรองและการกู้เป็นโฟลเดอร์ใหม่ */
import { listBackups, restoreBackupCopy } from "@/app/backup-actions";
/* BackupManager: หน้าจอเลือกชุดสำรองและกู้เป็นสำเนา แสดงผลการทำงานให้ผู้ใช้ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function BackupManager() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listBackups>>>(
      [],
    ),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<{ folder: string; database: string } | null>(
      null,
    ),
    [pending, start] = useTransition();
  return (
    <section
      style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #dce5e2" }}
      aria-label="กู้คืนชุดสำรอง"
    >
      <h3>กู้คืนชุดสำรอง</h3>
      <p>
        เลือกชุดสำรองในตำแหน่งจัดเก็บปัจจุบัน ระบบตรวจไฟล์ก่อนกู้ลงโฟลเดอร์ใหม่
        ฐานข้อมูลที่กำลังใช้งานยังคงเดิม
      </p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage("");
            try {
              setItems(await listBackups());
              setLoaded(true);
            } catch {
              setMessage("อ่านรายการไม่สำเร็จ กรุณาตรวจตำแหน่งจัดเก็บ");
            }
          })
        }
      >
        โหลดรายการชุดสำรอง
      </button>
      {loaded && !items.length && (
        <p>
          ยังไม่มีชุดสำรอง กด “ส่งออกข้อมูลทั้งหมดในเครื่อง” ก่อน
          แล้วโหลดรายการอีกครั้ง
        </p>
      )}
      {items.length > 0 && (
        <div style={{ maxHeight: 320, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>วันที่สำรอง</th>
                <th>หนังสือ</th>
                <th>ไฟล์</th>
                <th>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name}>
                  <td>
                    {item.at}
                    <small style={{ display: "block" }}>{item.name}</small>
                  </td>
                  <td>{item.documents}</td>
                  <td>{item.files}</td>
                  <td>
                    <button
                      disabled={pending || item.version !== 2}
                      onClick={() => {
                        if (
                          !confirm(
                            "ตรวจสอบและกู้ชุดนี้ลงโฟลเดอร์ใหม่หรือไม่? ระบบจะไม่สลับฐานข้อมูลที่ใช้งานอยู่",
                          )
                        )
                          return;
                        start(async () => {
                          setMessage("กำลังตรวจและกู้คืน…");
                          setResult(null);
                          try {
                            setResult(await restoreBackupCopy(item.name));
                            setMessage("ตรวจไฟล์และกู้คืนสำเร็จ");
                          } catch (e) {
                            setMessage(
                              e instanceof Error
                                ? e.message
                                : "กู้คืนไม่สำเร็จ",
                            );
                          }
                        });
                      }}
                    >
                      {item.version === 2
                        ? "ตรวจและกู้คืน"
                        : "รุ่นเก่า: ต้องใช้ผู้ดูแล"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {result && (
        <div>
          <p>
            ตำแหน่งที่กู้: <code>{result.folder}</code>
          </p>
          <p>
            ฐานข้อมูลที่กู้: <code>{result.database}</code>
          </p>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(result.folder)
                .then(() => setMessage("คัดลอกพาธแล้ว"))
                .catch(() => setMessage("กรุณาคัดลอกพาธที่แสดงด้วยตนเอง"))
            }
          >
            คัดลอกตำแหน่งที่กู้
          </button>
          <p>
            ยังไม่ได้เปลี่ยนฐานข้อมูลใช้งานจริง ให้ผู้ดูแลตรวจข้อมูล
            ตั้งค่าพื้นที่จัดเก็บและเชื่อม Google ใหม่ก่อนเริ่มใช้ชุดที่กู้
          </p>
        </div>
      )}
    </section>
  );
}
