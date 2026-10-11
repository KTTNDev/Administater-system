# การเชื่อม Google Drive

การเชื่อมต่อของแอปนี้เป็นอิสระจาก Google Drive connector ของ Codex ต้องสร้าง OAuth client ของระบบเอง และให้ผู้ดูแลบัญชีกดยินยอม

1. ใน Google Cloud Console สร้าง/เลือก project และเปิด Google Drive API
2. ตั้ง Google Auth Platform / OAuth consent screen เลือก Internal หากมี Google Workspace ที่รองรับและใช้ในองค์กร หรือ External สำหรับบัญชีที่เหมาะสม เพิ่มบัญชีทดสอบหากอยู่ในโหมด Testing
3. สร้าง OAuth client ประเภท Web application
4. เพิ่ม Authorized redirect URI ให้ตรงกับ APP_URL เช่น `http://127.0.0.1:3000/api/google/callback` หากเปิดผ่าน localhost ต้องเปลี่ยน APP_URL และ redirect ให้ตรงกัน
5. เลือกไฟล์ OAuth Client JSON ในหน้าตั้งค่า → ความพร้อมใช้งานจริง → ตั้งค่า Google Drive หรือกรอกใน `.env.local`

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
