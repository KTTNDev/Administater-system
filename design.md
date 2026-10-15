# สารบรรณ — แนวทางหน้าระบบ

ปรับปรุงด้วย Hallmark และ Humanizer วันที่ 10 ตุลาคม 2569

## เป้าหมาย

ผู้ใช้เปิดโปรแกรมเพื่อทำหนังสือและค้นเอกสาร รายการงานต้องเห็นได้เร็ว เมนูใช้ชื่อคงที่ คำอธิบายแสดงเมื่อช่วยตัดสินใจจริง รายละเอียดการตั้งค่าอยู่ในส่วนที่เปิดอ่านได้

## ระบบที่ใช้ร่วมกัน

- แนวทาง: modern-minimal / Workbench / Notion-inspired (reference: Notion Home, June 2024)
- พื้นขาวและเทาอุ่น เมนูสีอ่อน ใช้สีน้ำเงินเฉพาะปุ่มหลักและจุดโฟกัส สีสถานะยังแยกตามความหมาย
- ฟอนต์ส่วนติดต่อ: Tahoma, Segoe UI จากเครื่อง เพื่อทำงานแบบออฟไลน์
- ตัวเอกสารและตัวอย่างก่อนพิมพ์ใช้ฟอนต์และสัดส่วนเดิม แยกจาก UI
- ใช้ Lucide ชุดเดียวกับระบบเดิม
- ค่าสี ระยะห่าง และขนาดตัวอักษรอยู่ใน `src/app/workspace-tokens.css`
- เมนูและปุ่มอ่านได้ชัดในพื้นขาว มี focus ทันที รองรับการลดการเคลื่อนไหว
- ไม่เพิ่มภาพตกแต่งหรือข้อความโฆษณาในพื้นที่ทำงาน

## หน้าระบบ

| หน้า | โครงสร้าง |
| --- | --- |
| เอกสาร | ชื่อหน้าและสร้างหนังสือ → ทางลัดแบบหนังสือ → ค้นหา/สถานะ → รายการ → ถังขยะและทะเบียน |
| แบบหนังสือ | หมวดและแบบหนังสือเดิม โดยใช้รูปแบบส่วนกลาง |
| รายงาน | ตัวเลขจริงและรายงานเดิม |
| งานธุรการ / โอนงบประมาณ | รายการและฟอร์มเฉพาะงานเดิม |
| ปฏิทิน / จองห้องประชุม | ตารางเวลาและการทำงานเดิม |
| กฎหมาย / คู่มือ | เอกสารอ้างอิงและคำอธิบายที่จำเป็น |
| ตั้งค่า | ข้อมูลหน่วยงานและ Drive → พื้นที่จัดเก็บ/สำรอง → ความพร้อมใช้งาน |

## หลักการเขียน

ใช้ภาษาไทยตรงไปตรงมา ปุ่มขึ้นต้นด้วยการกระทำ เช่น สร้างหนังสือ กู้คืน สำรองตอนนี้ หลีกเลี่ยงหัวข้อหลายคำที่สื่อสิ่งเดียวกัน เก็บข้อจำกัดและคำอธิบายที่มีผลต่อการใช้ข้อมูล ไม่ใช้ Humanizer เปลี่ยนเนื้อหาหนังสือ ข้อกฎหมาย คำลงท้าย หรือข้อความที่ผู้ใช้กรอก

## ขอบเขตและการตรวจ

การปรับครั้งนี้เน้นหน้ารายการ เมนู ส่วนหัว และข้อความตั้งค่า โดยรักษาฟอร์มที่ผู้ใช้อนุมัติไว้ ตรวจการทำงานทั้ง 10 เมนู การย่อเมนู ทางลัดแป้นพิมพ์ และจอ 320 / 375 / 414 / 768 / 1440 พิกเซล

## Exports

โปรเจกต์ใช้ CSS และ CSS Modules โดยตรง แหล่งค่ากลางคือ `src/app/workspace-tokens.css` ไม่มี Tailwind หรือ shadcn runtime ค่าสีอื่นของส่วนเก่ายังคงอยู่เพื่อไม่เปลี่ยนฟอร์มที่อนุมัติไปพร้อมกัน


### CSS (ใช้จริง)

นำเข้า `src/app/workspace-tokens.css` ก่อนรูปแบบส่วนติดต่ออื่น สีและระยะทั้งหมดของหน้ารายการใหม่อ้างตัวแปรในไฟล์นี้

### Tailwind v4 (สำหรับนำไปใช้ในโครงการที่มี Tailwind)

```css
@theme inline {
  --color-background: var(--ui-canvas);
  --color-foreground: var(--ui-ink);
  --color-card: var(--ui-surface);
  --color-primary: var(--ui-accent);
  --color-primary-foreground: var(--ui-on-accent);
  --color-muted-foreground: var(--ui-muted);
  --color-border: var(--ui-border);
  --color-ring: var(--ui-focus);
  --font-sans: var(--ui-font);
  --radius-card: var(--ui-radius);
}
```

### DTCG (ค่าหลักสำหรับโปรแกรมจัดการ design token)

```json
{
  "sarabun": {
    "ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.215686,
          0.207843,
          0.184314
        ],
        "alpha": 1
      }
    },
    "muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.439216,
          0.435294,
          0.411765
        ],
        "alpha": 1
      }
    },
    "border": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.909804,
          0.905882,
          0.894118
        ],
        "alpha": 1
      }
    },
    "canvas": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          1.0,
          1.0,
          1.0
        ],
        "alpha": 1
      }
    },
    "surface": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          1.0,
          1.0,
          1.0
        ],
        "alpha": 1
      }
    },
    "subtle": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.968627,
          0.968627,
          0.960784
        ],
        "alpha": 1
      }
    },
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.090196,
          0.435294,
          0.658824
        ],
        "alpha": 1
      }
    },
    "accent-hover": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.070588,
          0.341176,
          0.501961
        ],
        "alpha": 1
      }
    },
    "accent-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.929412,
          0.956863,
          0.972549
        ],
        "alpha": 1
      }
    },
    "focus": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.137255,
          0.513725,
          0.709804
        ],
        "alpha": 1
      }
    },
    "warning": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.47451,
          0.333333,
          0.113725
        ],
        "alpha": 1
      }
    },
    "warning-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.980392,
          0.945098,
          0.866667
        ],
        "alpha": 1
      }
    },
    "danger": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.631373,
          0.235294,
          0.192157
        ],
        "alpha": 1
      }
    },
    "danger-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          0.988235,
          0.929412,
          0.917647
        ],
        "alpha": 1
      }
    },
    "on-accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [
          1.0,
          1.0,
          1.0
        ],
        "alpha": 1
      }
    }
  }
}
```

### shadcn/ui (สำหรับนำไปใช้ในโครงการที่มี shadcn)

```css
:root {
  --background: var(--ui-canvas);
  --foreground: var(--ui-ink);
  --card: var(--ui-surface);
  --card-foreground: var(--ui-ink);
  --popover: var(--ui-surface);
  --popover-foreground: var(--ui-ink);
  --primary: var(--ui-accent);
  --primary-foreground: var(--ui-on-accent);
  --secondary: var(--ui-subtle);
  --secondary-foreground: var(--ui-ink);
  --muted: var(--ui-subtle);
  --muted-foreground: var(--ui-muted);
  --accent: var(--ui-accent-soft);
  --accent-foreground: var(--ui-accent-hover);
  --destructive: var(--ui-danger);
  --destructive-foreground: var(--ui-on-accent);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --ring: var(--ui-focus);
  --radius: var(--ui-radius);
}
```

## ทิศทางที่ผู้ใช้เลือก 10 ตุลาคม 2569

ใช้ Notion เป็นหลัก: หน้าแรกมีเอกสารล่าสุด การ์ดเรียบ ไอคอนช่วยแยกส่วน และพื้นที่ว่าง เมนูแคบลงพร้อมแถบค้นหา ลำดับหัวเรื่องชัด รายละเอียดที่ใช้น้อยเปิดอ่านได้ ปรับทุกหน้าระบบแต่คงตัวจัดหน้าเอกสารและข้อมูลราชการเดิม

## ปรับความสบายตา 14 ตุลาคม 2569

คง modern-minimal / Workbench / Notion และระบบสีเดิม โดยลดการแสดงรายละเอียดพร้อมกัน: รายการเอกสารเริ่มจากชื่อ เลขที่ สถานะ และการจัดการ เปิดรายละเอียดเพื่อดูผู้รับ หน่วยงาน ปี และเวลาได้ เมนูใช้คำสั้นแต่ชื่อสำหรับการเข้าถึงยังครบ ส่วนร่างมีโหมดโฟกัสขยายพื้นที่เขียน ปุ่มเดิมและทางลัดยังใช้งานได้ รูปแบบราชการในเอกสารไม่เปลี่ยน

หน้าระบบใช้พื้นเทาอุ่นแยกกับพื้นที่ทำงานสีขาว กรอบบางและไอคอนสีน้ำเงินช่วยแยกกลุ่ม ลดกรอบซ้อนและพื้นเขียวหลายเฉดในฟอร์ม ความสำเร็จ/ข้อผิดพลาดยังแสดงด้วยข้อความและสีตามความหมาย ใช้ token เดิมทั้งหมดใน workspace-tokens.css และอ้างรูปแบบ export เดิม
