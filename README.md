# ระบบจัดทำและบริหารจัดการร่างหนังสือราชการ

โปรเจกต์ Next.js + TypeScript สำหรับจัดทำร่างหนังสือราชการ มีฐานข้อมูล SQLite จริง ฟอร์มตามประเภทหนังสือ Live Preview A4 การส่งออก PDF และ Google Drive OAuth เป็นโค้ดเริ่มต้นที่ทำงานได้สำหรับผู้ปฏิบัติงานหนึ่งหน่วยงานบน Node.js หนึ่ง instance

**ขอบเขตสำคัญ:** ระบบช่วยจัดทำและตรวจข้อมูลเบื้องต้น ไม่ใช่การรับรองความถูกต้องตามระเบียบ 100% หนังสือที่มีผลทางกฎหมาย หนังสือถึงผู้รับฐานะพิเศษ และแบบเฉพาะหน่วยงานต้องผ่านการตรวจรับจากเจ้าหน้าที่ผู้รับผิดชอบก่อนออกหนังสือจริง การพิมพ์ชื่อในช่องลงนามยังไม่ใช่ลายมือชื่อ และสถานะ “ตรวจทานแล้ว” ไม่ใช่สถานะอนุมัติ

## เริ่มใช้งานบน Windows

ใช้ Node.js 22.13 ขึ้นไป เปิด Terminal ใน `D:\sarabun`

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

เปิด http://127.0.0.1:3000 ค่า LOCAL_DEMO=true ทำงานเฉพาะ development เท่านั้น npm run dev ผูกกับ loopback เพื่อให้ทดลองบนเครื่องนี้ หากมี .env.local อยู่แล้ว **อย่าคัดลอกทับ**

ระบบใช้ Chrome หรือ Edge ที่ติดตั้งในตำแหน่งมาตรฐานเพื่อสร้าง PDF หากใช้ตำแหน่งอื่น ให้ตั้ง CHROMIUM_EXECUTABLE_PATH หรือดาวน์โหลดเบราว์เซอร์ของ Playwright:

```powershell
npx playwright install chromium
```

ไม่จำเป็นต้องเชื่อม Google Drive เพื่อสร้าง แก้ไข ค้นหา ลบ หรือดาวน์โหลด PDF ข้อมูลหน่วยงานตัวอย่างเป็นข้อมูลสมมติ ปุ่ม “ใช้ข้อมูลตัวอย่าง” มีไว้ทดลองรูปแบบเท่านั้น

## โครงสร้างโฟลเดอร์

```text
D:\sarabun
├── src/
│   ├── app/
│   │   ├── page.tsx                 โหลดร่างและตั้งค่าจากเซิร์ฟเวอร์
│   │   ├── layout.tsx               ภาษาไทยและ metadata
│   │   ├── globals.css              UX/UI และ responsive layout
│   │   ├── actions.ts               CRUD ตรวจทาน สำเนาร่าง audit และการเข้าสู่ระบบ
│   │   ├── login/page.tsx           หน้าลงชื่อเข้าใช้
│   │   └── api/
│   │       ├── documents/[id]/pdf/route.ts
│   │       └── google/
│   │           ├── connect/route.ts
│   │           └── callback/route.ts
│   ├── components/workspace.tsx    หน้ารวมร่าง คลังแบบ ฟอร์ม Preview และตั้งค่า
│   └── lib/
│       ├── templates.ts            ทะเบียน 6 หมวด 13 แบบและข้อมูลหน่วยงาน
│       ├── document.ts             Zod schema วันที่ พ.ศ. ปีงบประมาณ validation
│       ├── render-document.ts      สร้าง HTML และแบ่งหน้า ใช้ร่วมกันกับ PDF
│       ├── assets.ts               โหลดฟอนต์และตราครุฑจากไฟล์ในโปรเจกต์
│       ├── pdf.ts                  Chromium PDF export
│       ├── db.ts                   SQLite transaction และ version conflict
│       ├── auth.ts                 signed session cookie
│       └── drive.ts                OAuth token encryption และ folder/file upload
├── public/
│   ├── fonts/                      TH Sarabun New Regular/Bold
│   └── assets/garuda.png           ตราครุฑจากแผ่นแบบ สถ.
├── references/                     ต้นฉบับและผลการวิเคราะห์เอกสาร
├── docs/                           ขอบเขตและบันทึกทดสอบ
├── tests/                          unit tests และ browser tests
├── data/sarabun.sqlite             สร้างอัตโนมัติ ไม่รวมใน Git
├── .env.example                    รายการตัวแปรที่ต้องตั้งค่า
├── next.config.ts
├── tsconfig.json
├── package.json
└── package-lock.json               เวอร์ชัน dependencies ที่ติดตั้งจริง
```

## ฟังก์ชันที่มี

| ส่วน | การทำงาน |
|---|---|
| แบบหนังสือ | ภายนอก ภายใน ประทับตรา คำสั่ง ระเบียบ ข้อบังคับ ประกาศ แถลงการณ์ ข่าว หนังสือรับรอง รายงานการประชุม บันทึก และหนังสืออื่น |
| Live Preview | A4 210 × 297 มม. พร้อมซูมและแบ่งหน้าไทยตามขนาดที่วัดจริงในเบราว์เซอร์ |
| CRUD | สร้าง อ่าน แก้ไข ลบ และทำสำเนาร่าง ค้นหาจากเรื่อง เลขที่ ผู้รับ และหน่วยงาน กรองประเภทและสถานะ |
| การจัดเก็บ | SQLite WAL, transaction, optimistic concurrency ด้วย version และ audit create/update/delete/upload |
| Validation | วันที่มีอยู่จริง ช่องข้อมูลตามประเภทผู้รับ ผู้ลงนาม และรายละเอียดการประชุม ตรวจซ้ำฝั่ง Server Action |
| Auto-fill | ข้อมูลหน่วยงานที่บันทึกไว้ และรายการส่วนราชการตัวอย่าง แก้ไขข้อความได้ |
| PDF | ฝังฟอนต์และตราครุฑ สร้างไฟล์ด้วย renderer เดียวกับ preview ทุกหน้ากระดาษ |
| Drive | OAuth 2.0 ขอบเขต drive.file เก็บ refresh token แบบ AES-256-GCM และสร้างโฟลเดอร์ชนิด/ปี |
| เข้าสู่ระบบ | บัญชีผู้ปฏิบัติงานร่วมของหน่วยงาน มี session 8 ชั่วโมง จำกัดการลองรหัสผ่านผิด |

ฟอร์มเป็น controlled React component และ debounce preview 300 ms ร่างบันทึกลงเซิร์ฟเวอร์เมื่อกดบันทึก มีเตือนออกจากหน้าหากยังไม่บันทึก **ยังไม่มี autosave ลงเซิร์ฟเวอร์**

## ตั้งค่า Google Drive

การเชื่อมต่อของแอปนี้เป็นอิสระจาก Google Drive connector ของ Codex ต้องสร้าง OAuth client ของระบบเอง และให้ผู้ดูแลบัญชีกดยินยอม

1. ใน Google Cloud Console สร้าง/เลือก project และเปิด Google Drive API
2. ตั้ง Google Auth Platform / OAuth consent screen เลือก Internal หากมี Google Workspace ที่รองรับและใช้ในองค์กร หรือ External สำหรับบัญชีที่เหมาะสม เพิ่มบัญชีทดสอบหากอยู่ในโหมด Testing
3. สร้าง OAuth client ประเภท Web application
4. เพิ่ม Authorized redirect URI ให้ตรงกับ APP_URL เช่น `http://127.0.0.1:3000/api/google/callback` หากเปิดผ่าน localhost ต้องเปลี่ยน APP_URL และ redirect ให้ตรงกัน
5. กรอกใน `.env.local`

```dotenv
APP_URL=http://127.0.0.1:3000
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-random-secret-at-least-32-characters
```

6. เริ่มเซิร์ฟเวอร์ใหม่ เปิดตั้งค่าหน่วยงานและ Drive แล้วกดเชื่อมต่อ ลงชื่อเข้าใช้ด้วยบัญชีหน่วยงาน
7. เปิดร่าง กรอกข้อมูลครบ ตรวจรูปแบบ แล้วเลือก “ฉันได้ตรวจ…” จากนั้นกดบันทึก PDF ไปยัง Drive

ระบบจัดเก็บดังนี้:

```text
สารบรรณ/
  หนังสือภายนอก/
    ปีงบประมาณ 2570/
      มท 0000-123_ชื่อเรื่อง.pdf
```

วันที่หนังสือ 30 ก.ย. 2569 อยู่ปีงบประมาณ 2569 ส่วน 1 ต.ค. 2569 อยู่ปีงบประมาณ 2570 หากเลือกปีปฏิทิน ทั้งสองวันยังอยู่ปี 2569 ระบบคำนวณจากวันที่หนังสือ ไม่ใช่วันที่อัปโหลด

อัปโหลดครั้งถัดไปอัปเดตไฟล์เดิมโดยค้น appProperties.documentId หากเปลี่ยนประเภท/ปี จะย้ายไฟล์ไปโฟลเดอร์ใหม่ มีคิวอัปโหลดใน process เดียวและจอง Drive ID ก่อนสร้าง ช่วยลดไฟล์/โฟลเดอร์ซ้ำเมื่อการตอบกลับสูญหาย การลองใหม่เริ่มจากปุ่มอัปโหลดอีกครั้งหลังแก้ปัญหา

ไม่เรียก API แชร์ไฟล์เป็นสาธารณะ สิทธิ์ของไฟล์สืบทอดจากโฟลเดอร์จริงใน Drive การลบร่างในระบบไม่ลบไฟล์บน Drive ปัจจุบันไม่รองรับการอัปโหลดหนังสือที่กำหนดชั้นความลับ

ใช้ OAuth ในนามผู้ใช้สำหรับ My Drive ไม่ใช้ service account เป็นเจ้าของไฟล์ใน My Drive เนื่องจาก service account ไม่มีพื้นที่เป็นเจ้าของไฟล์ หากต้องการ Shared Drive ต้องต่อยอดตัวเลือก driveId/supportsAllDrives และทดสอบสิทธิ์ขององค์กร

## Dependencies ที่ใช้

ติดตั้งทั้งหมดจาก package.json ด้วย npm install ไม่ต้องติดตั้งรายตัว แต่คำสั่งเทียบเท่าคือ:

```powershell
npm install next react react-dom zod @googleapis/drive jose lucide-react server-only playwright
npm install --save-dev typescript @types/node @types/react @types/react-dom vitest @playwright/test
```

| Package | ใช้ทำอะไร |
|---|---|
| next / react / react-dom | App Router, Server Actions, ฟอร์มและหน้าจอ |
| typescript / @types/* | ตรวจชนิดข้อมูล |
| zod | ตรวจข้อมูลเข้าและ schema |
| node:sqlite (มากับ Node.js) | ฐานข้อมูล SQLite จริงบน persistent disk |
| @googleapis/drive (รวม auth export) | Google OAuth และ Drive API |
| jose | สร้างและตรวจ JWT session |
| lucide-react | ไอคอน interface |
| server-only | ป้องกันการ import โค้ดลับเข้าสู่ client bundle |
| playwright | Chromium PDF engine |
| vitest / @playwright/test | Unit/integration/browser tests |

ใช้ Node.js crypto สำหรับ AES-256-GCM และการเทียบรหัสผ่านด้วย timingSafeEqual ฟอนต์โหลดจากไฟล์ใน public จึงไม่ต้องติดต่อ Google Fonts ขณะใช้งาน

## ตรวจสอบและ build

```powershell
npm run typecheck
npm test
npm run build
# เปิด npm run dev ใน Terminal อีกช่องก่อนรัน browser tests
npm run test:e2e
```

Unit tests ใช้ฐานข้อมูลชั่วคราวแยกต่างหาก Browser tests สร้างร่างชื่อทดสอบและลบเมื่อจบ หากทดสอบถูกขัดจังหวะให้ลบร่างทดสอบที่เหลือในหน้ารายการ

## ก่อนนำขึ้นใช้งานจริง

1. ตั้ง LOCAL_DEMO=false, APP_PASSWORD อย่างน้อย 12 ตัวอักษร และ SESSION_SECRET แบบสุ่มอย่างน้อย 32 ตัวอักษร ห้าม commit .env.local
2. ตั้ง APP_URL เป็น HTTPS origin ของระบบ และให้ reverse proxy ส่ง Host/Origin ถูกต้อง Run `npm run build` แล้ว `npm start` ซึ่งผูก loopback เพื่อให้ reverse proxy รับการเชื่อมต่อภายนอก
3. ใช้ disk ถาวรสำหรับ DATABASE_PATH สำรอง SQLite ด้วย SQLite backup API หรือหยุดแอปก่อนสำรอง ห้ามคัดลอกเฉพาะ .sqlite ระหว่างเปิด WAL โดยไม่เก็บธุรกรรมให้ครบ
4. จำกัดสิทธิ์อ่านฐานข้อมูล สำรองข้อมูล และ secret การเปลี่ยน SESSION_SECRET จะทำให้ token Drive ที่เข้ารหัสไว้เดิมอ่านไม่ได้ ต้องเชื่อมต่อบัญชีใหม่
5. รุ่นนี้ใช้บัญชีร่วมหนึ่งหน่วยงาน หากใช้หลายคน ให้เพิ่ม SSO, role/permission, tenant ownership, ประวัติเนื้อหาแต่ละ revision และ audit ผู้กระทำก่อนเปิดใช้งานหลายหน่วยงาน
6. ใช้ Node.js หนึ่ง instance บน persistent disk ไม่ใช่ static hosting หรือ serverless filesystem ชั่วคราว หาก scale out ให้ย้าย DB และคิวอัปโหลดเป็น PostgreSQL/worker queue
7. ให้ผู้รับผิดชอบงานสารบรรณตรวจและอนุมัติ template จริง โดยเฉพาะตำแหน่งครุฑ หัวหนังสือหลายบรรทัด การขึ้นหน้าใหม่ คำขึ้นต้น/ลงท้าย ผู้ลงนาม รูปถ่ายหนังสือรับรอง และแบบเฉพาะงาน

ยังไม่รวมทะเบียนรับ–ส่ง การจองเลขหนังสือ เวิร์กโฟลว์อนุมัติ ลายมือชื่ออิเล็กทรอนิกส์ การเก็บรักษา/ทำลายตามอายุเอกสาร ตราประทับจริง รูปถ่ายในหนังสือรับรอง และแบบภาษาอังกฤษ การเลือกชั้นความลับเป็นเพียงการจัดวางข้อความและบล็อกอัปโหลด ยังไม่ใช่ระบบเอกสารลับที่ผ่านการรับรอง

## แหล่งอ้างอิง

- [แผ่นแบบหนังสือราชการ สถ.](https://www.dla.go.th/land/govloadfon.do) — หน้าเดิมที่มี query บางครั้งตอบกลับว่าง ใช้หน้าฐานเดียวกันที่มีลิงก์ดาวน์โหลด 3 แบบ ตรวจและเก็บไฟล์ต้นฉบับไว้แล้ว
- [ระเบียบงานสารบรรณ ฉบับฐานที่หน่วยงานราชการเผยแพร่](https://porncharoen.go.th/storage/customer/34-vVG0mevzoJ/document/34-2024-09-17-17-17-13-167966/35149-2024-09-17-17-17-13-858114.pdf) — ใช้ตรวจหมวด/องค์ประกอบ ข้อ 11–27 ไม่ใช้แทนฉบับรวมแก้ไขล่าสุด
- [ETDA อธิบาย e-Saraban และระเบียบฉบับที่ 4 พ.ศ. 2564](https://www.etda.or.th/th/Useful-Resource/knowledge-sharing/articles/Digital-Law/ETDA-Live-Ep-7-e-Saraban.aspx)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Google Drive folders](https://developers.google.com/workspace/drive/api/guides/folder)
- [Google Drive upload](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

ดูผลวัดและความต่างจากต้นฉบับใน references/ANALYSIS.md


## เครื่องมือเพิ่มเติม (9 กันยายน 2569)
- `src/components/document-tools.tsx`: ตราความเร็ว/ชั้นความลับ สำเนา ร่าง–พิมพ์–ตรวจ เลขไทย ผู้เสนอ 5 คนเพิ่มเติมจากผู้ลงนามหลัก และความเห็นสูงสุด 4 ส่วน
- `src/app/legal-actions.ts` และ `src/app/api/legal/[id]/route.ts`: คลังอ้างอิง CRUD พร้อมลิงก์ มาตรา บันทึกการตรวจสอบ และ PDF ไม่เกิน 700 KB (ขีดจำกัด Server Action 1 MB) ไฟล์อยู่ใน SQLite และอ่านผ่านการตรวจ session
- เนื้อหาเลือกแบบอิสระหรือข้อเท็จจริง / ข้อกฎหมาย / ข้อพิจารณา / ข้อเสนอได้ การสลับไม่ลบข้อความเดิม แต่สองโหมดเป็นข้อมูลแยกกัน
- เอกสารเก่ารับค่าเริ่มต้นผ่าน Zod จึงไม่ต้องเขียนทับข้อมูลเดิม เลขไทยเป็นตัวเลือกการแสดงผล ไม่แปลงวัน ISO หรืออีเมล
- พิมพ์ตราข้อความรวมใน Preview/PDF ได้ แต่ยังไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์หรือระบบรับรองสำเนา
- ที่มาและข้อจำกัด: `references/STAMPS-AND-OPINIONS.md`

### Runtime ของเครื่องนี้
ไฟล์ต้นฉบับอยู่ D:\sarabun แต่ dependencies และ Next runtime ใช้ C:\Users\rawai\AppData\Local\sarabun-runtime-01a0812a เนื่องจากการอ่าน/เขียน dependencies บน D ช้ามาก `.runtime-local.json` ระบุที่อยู่เฉพาะเครื่อง และ `scripts/run-next.mjs` ตรวจ marker ก่อนคัดลอกไฟล์ต้นฉบับให้ runtime ฐานข้อมูลยังอยู่ D:\sarabun\data ไม่ควรแก้ src ใน runtime โดยตรง เครื่องอื่นที่ไม่มีไฟล์ตั้งค่านี้ใช้ npm install และ npm run dev ตามปกติได้

### สถานะการตรวจรอบฟีเจอร์เพิ่ม
หน้าเว็บคอมไพล์และแสดงเครื่องมือใหม่ผ่าน dev server แล้ว ตรวจด้วยเบราว์เซอร์พบตราด่วน/ลับ/สำเนา เลขไทย และการแบ่งหน้าความเห็น ชุด typecheck/unit/E2E ยังต้องรันใหม่: คำสั่งรันชุดทดสอบก่อนหน้านี้ถูก automatic approval review ปฏิเสธด้วยเหตุ usage limit จึงยังไม่อ้างว่าผ่านทั้งหมด และยังไม่ได้ตรวจ Google Drive ด้วยบัญชีจริง
