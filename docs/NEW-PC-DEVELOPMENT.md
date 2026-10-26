# พัฒนาและเปิดสารบรรณบนเครื่อง Windows ใหม่

คู่มือนี้เริ่มจากเครื่องที่ไม่มีโฟลเดอร์โปรเจกต์ ใช้ GitHub เป็นแหล่งโค้ดและฐานข้อมูลใหม่ที่ว่างเปล่า โค้ดจาก GitHub ไม่รวมร่างหนังสือ ไฟล์แนบ ข้อมูลบัญชี Google Drive หรือไฟล์ `.env.local` ของเครื่องเก่า

## 1. เตรียมเครื่อง

ต้องมี Windows x64, Microsoft Edge หรือ Google Chrome และอินเทอร์เน็ตสำหรับดึงโค้ด/ติดตั้งแพ็กเกจ ติดตั้ง **Git for Windows** และ **Node.js** รุ่นที่โครงการรองรับ (อย่างน้อย 22.13) หากเครื่องไม่มี ให้เปิด PowerShell แล้วใช้:

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

ปิดแล้วเปิด PowerShell ใหม่ ตรวจด้วย `git --version`, `node --version` และ `npm.cmd --version` หากเครื่องไม่มี `winget` ให้ติดตั้งจากหน้าอย่างเป็นทางการของ Git และ Node.js แทน การเขียนโค้ดจะใช้ VS Code หรือ Codex ก็ได้ ไม่จำเป็นต่อการเปิดโปรแกรมที่สร้างแล้ว

บนเครื่องทดสอบรอบนี้ `npm` ใน PowerShell ชี้ไปยังไฟล์ภายใต้ AppData ที่ใช้ไม่ได้ แต่ `npm.cmd` ซึ่งมากับ Node.js ใช้งานได้ จึงใช้ `npm.cmd` ในคำสั่งด้านล่างเสมอ

## 2. ดึงโค้ดจาก GitHub

เลือกโฟลเดอร์ **ภายในเครื่อง** เช่น `C:\Users\<ชื่อผู้ใช้>\source` แล้วเปิด PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\source" | Out-Null
Set-Location "$env:USERPROFILE\source"
git clone https://github.com/KTTNDev/Administater-system.git sarabun
Set-Location sarabun
git status --short
```

ผล `git status --short` ควรว่าง หาก GitHub ขอเข้าสู่ระบบ ให้ใช้บัญชีที่เข้าถึง repo นี้ได้ อย่าคัดลอก `.git`, `node_modules` หรือฐานข้อมูลจากเครื่องเดิมมาทับ clone ใหม่นี้

## 3. ติดตั้งและตรวจโค้ด

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
```

`npm ci` ใช้รุ่นแพ็กเกจจาก `package-lock.json` แน่นอน หลังติดตั้งครั้งแรก ถ้าดึงโค้ดรุ่นใหม่ที่เปลี่ยน lockfile ให้รันซ้ำ โปรแกรมปกติบน PC ไม่ต้องรัน `npm run dev` ทุกครั้ง

## 4. สร้างและเปิดโปรแกรม

```powershell
npm.cmd run desktop:build
.\Create-Shortcuts-Sarabun.cmd
.\Open-Sarabun.cmd
```

การเปิดครั้งแรกสร้าง `.env.local` พร้อมรหัสลับเฉพาะเครื่อง และสร้างฐานข้อมูลใหม่ภายใต้ `data` ให้อัตโนมัติ ทางลัด “Sarabun - New PC” เปิดโปรแกรม และอีกทางลัดใช้หยุดโปรแกรม ทางลัดชี้ไปที่โฟลเดอร์ที่ clone นี้ ถ้าย้ายโฟลเดอร์ ให้รัน `Create-Shortcuts-Sarabun.cmd` ใหม่

ระบบเปิดที่ `http://127.0.0.1:3000` ได้ทีละชุดเท่านั้น ถ้าเครื่องมีสารบรรณชุดเก่าเปิดอยู่ ให้บันทึกงานและหยุดชุดเก่าก่อนเปิดชุดใหม่นี้ ห้ามปิดเซิร์ฟเวอร์ที่ใช้งานโดยไม่ตรวจงานค้าง การทดสอบรุ่นใหม่แบบแยกข้อมูลสามารถใช้ `npm.cmd run test:release` ซึ่งรันบนพอร์ต 3100 และฐานข้อมูลทิ้งหลังทดสอบ

## 5. ใช้ Google Drive อย่างเหมาะสม

เก็บ **โค้ดที่รันและฐานข้อมูลจริง** ในเครื่อง ส่วน `G:\My Drive` ใช้เก็บชุดสำรองหรือชุดส่งต่อเครื่องอื่นได้ ระบบสำรองอัตโนมัติลง `output\storage\สำรองข้อมูล` ภายใต้โปรเจกต์เป็นค่าเริ่มต้น หลังหยุดโปรแกรมให้คัดลอกชุดสำรองที่เสร็จสมบูรณ์ไป Drive และตรวจสถานะซิงก์ ตัวอย่าง:

```powershell
$backupSource = Join-Path (Get-Location) 'output\storage\สำรองข้อมูล'
$backupTarget = 'G:\My Drive\Sarabun Backups'
if (Test-Path -LiteralPath $backupSource) {
  New-Item -ItemType Directory -Path $backupTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $backupSource '*') -Destination $backupTarget -Recurse -Force
}
```

ถ้าปรับโฟลเดอร์จัดเก็บในหน้าตั้งค่า ให้ใช้ที่อยู่ชุดสำรองล่าสุดที่แสดงในหน้านั้นแทน `output\storage` หลีกเลี่ยงการซิงก์ `node_modules`, `.next*` และฐานข้อมูล SQLite ที่กำลังใช้งาน

หากต้องการ **ข้อมูลเดิม** บนเครื่องใหม่ ให้ส่งออกชุด Personal หรือกู้ชุดสำรองที่เชื่อถือได้ตาม [คู่มือเริ่มใช้และย้ายเครื่อง](../QUICK-START-TH.md) GitHub เก็บโค้ดเท่านั้น จึงไม่ทำให้เอกสารเดิมกลับมาเอง เก็บไฟล์ Personal เป็นข้อมูลส่วนตัว อย่าอัปขึ้น GitHub

## 6. พัฒนาและอัปเดต

```powershell
git pull --ff-only
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run desktop:build
```

หยุดโปรแกรมก่อนสลับรุ่นที่ใช้งานจริง เปิดด้วยทางลัดหลังสร้างชุดใหม่ หากเขียนโค้ดใหม่ ให้ทดสอบก่อนคอมมิต และ `git push` ด้วยบัญชี GitHub ของตนเอง อย่าคอมมิต `data`, `output`, `.env.local`, `.desktop` หรือไฟล์ข้อมูลส่วนตัว

## เช็กรอบแรก

- [ ] clone จาก GitHub ลงโฟลเดอร์ใหม่และ `git status --short` ว่าง
- [ ] `npm.cmd ci`, TypeScript และชุดทดสอบผ่าน
- [ ] build โปรแกรม PC สำเร็จ
- [ ] เปิดโปรแกรมและตัวอย่าง A4 ด้วยข้อมูลว่างของเครื่องใหม่ได้
- [ ] ทางลัดเปิด/หยุดชี้โฟลเดอร์ที่ต้องการ
- [ ] หากย้ายข้อมูลเดิม จำนวนร่างและไฟล์แนบตรงกับชุดสำรอง
- [ ] เลือกโฟลเดอร์สำรองใน Drive และตรวจวันสำรองสำเร็จล่าสุด
