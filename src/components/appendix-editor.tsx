"use client";
/**
 * แผนที่อ่านโค้ด — src/components/appendix-editor.tsx
 * หน้าที่: เพิ่มภาพภาคผนวก ปรับความกว้าง คำบรรยาย และรูปแบบเรียงภาพ
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../lib/document.ts
 * 2. ./appendix-editor.tsx ← คุณอยู่ที่นี่
 * 3. ../app/appendix-actions.ts
 * 4. ../lib/appendix.ts
 * 5. ../lib/render-document.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./workspace.tsx
 * อ่านต่อจาก import: ../lib/document.ts, ../app/appendix-actions.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useState } from "react";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Draft } from "@/lib/document";
/* นำเข้า ../app/appendix-actions.ts — รับภาพภาคผนวกและส่ง data URL กลับให้หน้าจอหลังตรวจสิทธิ์ */
import { uploadAppendixImage } from "@/app/appendix-actions";

/* ชนิด ImageItem: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type ImageItem = Draft["appendixImages"][number];
/* ชนิด Props: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Props = {
  title: string;
  layout: Draft["appendixLayout"];
  images: ImageItem[];
  sources: Record<string, string>;
  onTitle: (value: string) => void;
  onLayout: (value: Draft["appendixLayout"]) => void;
  onImages: (value: ImageItem[]) => void;
  onSources: (value: Record<string, string>) => void;
  onBusy: (value: boolean) => void;
};
/* AppendixEditor: เพิ่มภาพภาคผนวก ปรับความกว้าง คำบรรยาย และรูปแบบเรียงภาพ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
export function AppendixEditor({
  title,
  layout,
  images,
  sources,
  onTitle,
  onLayout,
  onImages,
  onSources,
  onBusy,
}: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  /* add: เพิ่มภาพภาคผนวก ปรับความกว้าง คำบรรยาย และรูปแบบเรียงภาพ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  async function add(file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (images.length >= 20) throw new Error("เพิ่มได้ไม่เกิน 20 ภาพ");
      const form = new FormData();
      form.set("file", file);
      const result = await uploadAppendixImage(form);
      if (!result.ok) throw new Error(result.error);
      if (
        images.reduce((total, image) => total + image.bytes, 0) +
          result.data.bytes >
        50 * 1024 * 1024
      )
        throw new Error("ภาพแนบท้ายรวมเกิน 50 MB");
      const { source, ...item } = result.data;
      onImages([...images, item]);
      onSources({ ...sources, [item.id]: source });
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มรูปภาพไม่สำเร็จ");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  /* move: เพิ่มภาพภาคผนวก ปรับความกว้าง คำบรรยาย และรูปแบบเรียงภาพ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function move(index: number, direction: -1 | 1) {
    const updated = [...images];
    [updated[index], updated[index + direction]] = [
      updated[index + direction],
      updated[index],
    ];
    onImages(updated);
  }
  /* remove: เพิ่มภาพภาคผนวก ปรับความกว้าง คำบรรยาย และรูปแบบเรียงภาพ — ตามการเรียกฟังก์ชันที่ import ด้านบนเพื่อดูการทำงานชั้นถัดไป */
  function remove(item: ImageItem) {
    onImages(images.filter((image) => image.id !== item.id));
    const next = { ...sources };
    delete next[item.id];
    onSources(next);
  }
  return (
    <details className="form-section appendix-editor" open>
      <summary>
        <span className="step-number">＋</span>
        <strong>เอกสารแนบท้าย · ภาพประกอบ</strong>
        <span>{images.length} ภาพ</span>
      </summary>
      <div className="field-grid">
        <label className="wide">
          หัวเรื่องเอกสารแนบท้าย
          <input
            value={title}
            maxLength={200}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="เช่น ภาพประกอบแสดงอุปกรณ์อินเทอร์เน็ตด้านจำนวน 2 หมายเลข"
          />
        </label>
        <label className="wide">
          รูปแบบจัดหน้า
          <select
            value={layout}
            onChange={(e) =>
              onLayout(e.target.value as Draft["appendixLayout"])
            }
          >
            <option value="auto">อัตโนมัติตามแนวภาพ (แนะนำ)</option>
            <option value="stack">เรียงเต็มความกว้าง ทีละภาพ</option>
            <option value="columns">วาง 2 คอลัมน์</option>
          </select>
        </label>
        <p className="field-note wide">
          ระบบจัดภาพครั้งละไม่เกิน 2 ภาพต่อหน้า: ภาพแนวนอนคู่จะเรียงบน–ล่าง,
          ภาพแนวตั้งคู่จะวาง 2 คอลัมน์
          และภาพผสมจะวางแนวนอนเต็มแถวกับภาพแนวตั้งกึ่งกลางแถวถัดไป
          คุณปรับขนาดภาพและข้อความกำกับแต่ละภาพได้
        </p>
        <label className="wide appendix-upload">
          {busy ? (
            "กำลังจัดเก็บภาพ…"
          ) : (
            <>
              <ImagePlus size={17} /> เพิ่มภาพ PNG หรือ JPEG
            </>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy || images.length >= 20}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void add(file);
            }}
          />
        </label>
        {error && (
          <p className="wide overflow-alert" role="alert">
            {error}
          </p>
        )}
        {images.map((item, index) => (
          <section className="wide appendix-image-card" key={item.id}>
            <div className="appendix-image-thumb">
              {sources[item.id] ? (
                <img src={sources[item.id]} alt="ตัวอย่างภาพแนบท้าย" />
              ) : (
                <span>กำลังโหลดภาพ</span>
              )}
            </div>
            <div className="appendix-image-fields">
              <div className="appendix-image-title">
                <strong>ภาพที่ {index + 1}</strong>
                <div>
                  <button
                    type="button"
                    aria-label="เลื่อนภาพขึ้น"
                    title="เลื่อนขึ้น"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="เลื่อนภาพลง"
                    title="เลื่อนลง"
                    disabled={busy || index === images.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="เอาภาพออก"
                    title="เอาภาพออก"
                    disabled={busy}
                    onClick={() => remove(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <label>
                ข้อความกำกับภาพ
                <input
                  value={item.caption}
                  maxLength={500}
                  placeholder="เช่น ภาพที่ 1 แสดงอุปกรณ์หมายเลข…"
                  onChange={(e) =>
                    onImages(
                      images.map((image) =>
                        image.id === item.id
                          ? { ...image, caption: e.target.value }
                          : image,
                      ),
                    )
                  }
                />
              </label>
              <label>
                ความกว้างภาพ · {item.widthMm} มม.
                <input
                  type="range"
                  min={30}
                  max={180}
                  step={5}
                  value={item.widthMm}
                  onChange={(e) =>
                    onImages(
                      images.map((image) =>
                        image.id === item.id
                          ? { ...image, widthMm: Number(e.target.value) }
                          : image,
                      ),
                    )
                  }
                />
              </label>
              <small>
                {item.name} · {item.width} × {item.height} px ·
                ปรับขนาดโดยคงสัดส่วนภาพ
              </small>
            </div>
          </section>
        ))}
        {!images.length && (
          <p className="field-note wide">
            เพิ่มภาพเพื่อสร้างหน้าภาคผนวกต่อท้ายหนังสือ เลือกได้สูงสุด 20 ภาพ ·
            ไม่เกิน 10 MB ต่อภาพ · รูปภาพจะรวมอยู่ใน PDF และข้อมูลสำรอง
          </p>
        )}
      </div>
    </details>
  );
}
