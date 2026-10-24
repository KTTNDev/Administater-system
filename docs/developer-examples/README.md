# แบบฝึก TypeScript สำหรับคู่มือ 1.4.1

ใช้จากราก repository หลัง `npm ci` ตัวอย่างไม่เรียก DB ของโปรแกรมและไม่แก้ข้อมูลผู้ใช้

```powershell
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --types node docs/developer-examples/typescript-lab.ts
node --experimental-strip-types docs/developer-examples/typescript-lab.ts
```

Node 22.13.1 อาจแจ้ง ExperimentalWarning เรื่อง type stripping ซึ่งเป็นคนละเรื่องกับ typecheck: คำสั่ง Node ไม่ตรวจชนิด จึงต้องรัน tsc ก่อน

## ฝึกต่อ

1. ลบ @ts-expect-error ทีละบรรทัด แล้วอ่าน error จาก tsc (คืนไว้เมื่อทำเสร็จ)
2. เพิ่มชนิด `{ kind: 'qr'; value: string }` ใน Floating โดยยังไม่เพิ่ม switch case ดูว่า never ช่วยเตือนอย่างไร
3. เพิ่ม contact default และทดสอบข้อมูลเก่าที่ไม่มีฟิลด์นี้
4. เปลี่ยน setField ให้ใช้ any แล้วอธิบายว่าการป้องกันอะไรหายไป ก่อนคืน generic
5. ทำ workshop ผู้ประสานงานบท 33-34 ใน branch/DB ฝึกแยก ตัวอย่างนี้ไม่ได้เพิ่มฟิลด์ให้แอปจริง

คำตอบตรวจตัวเอง: schema ตรวจ runtime, union แยกด้วย kind, generic ผูกชื่อฟิลด์กับชนิดค่า, object spread คืน object ใหม่ และ @ts-expect-error จะเตือนเมื่อบรรทัดนั้นไม่เกิด type error ตามที่คาดอีกแล้ว
