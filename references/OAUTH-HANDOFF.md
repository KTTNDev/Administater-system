# Google OAuth — สถานะและขั้นตอนต่อ

สถานะ 14 กันยายน 2569: เตรียม SESSION_SECRET และตัวนำเข้า client JSON แล้ว แต่ยังไม่มี OAuth Client ID/Secret และยังไม่ได้ยืนยันการเชื่อมต่อจากเว็บจริง การอัปโหลดกฎหมายผ่านเครื่องมือ Drive ในแชทไม่ใช่หลักฐานว่า OAuth ของเว็บเชื่อมต่อแล้ว

## ค่าที่ใช้กับ Google Cloud

- Application type: Web application
- JavaScript origin: `http://127.0.0.1:3000`
- Authorized redirect URI: `http://127.0.0.1:3000/api/google/callback`
- API: Google Drive API
- Scope ของเว็บ: `https://www.googleapis.com/auth/drive.file`
- Root folder: `1RoVDuJDLfLjsTNwzbV9xYkMeV4oWkCQM`

สร้างหรือเลือก Cloud project, ตั้งค่า Google Auth Platform (ชื่อแอป/อีเมลติดต่อ/Audience) และเพิ่มบัญชีผู้ทดสอบตามจริง ก่อนสร้าง Web application client ห้ามใส่ Client secret ลงโค้ดฝั่ง browser หรือส่งลงแชท

ดาวน์โหลด JSON จากหน้า client แล้วรันในโฟลเดอร์โปรเจกต์:

```powershell
node scripts/setup-google-oauth.mjs 'C:\path\client_secret.json'
```

สคริปต์ตรวจชนิด Web client และ redirect URI เขียน `.env.local` โดยไม่แสดง secret และไม่เปลี่ยน SESSION_SECRET เดิม รีสตาร์ต dev server แล้วใช้ปุ่มเชื่อม Google Drive ในหน้าตั้งค่า

## สิ่งที่ต้องทดสอบก่อนถือว่าสำเร็จ

1. ล็อกอินและ callback ผ่าน พร้อมแสดงบัญชีที่เชื่อมต่อ
2. ทดสอบเข้าถึง root folder ด้วย OAuth ของเว็บเอง
3. Scope `drive.file` ไม่ให้เข้าถึงทุกโฟลเดอร์เดิมอัตโนมัติ หากไม่เห็น root ต้องให้ผู้ใช้เลือกผ่าน Google Picker ใน Cloud project เดียวกัน ไม่เพิ่ม scope แบบทั้ง Drive โดยพลการ
4. อัปโหลดเอกสารทดสอบจากเว็บ อ่าน metadata ยืนยันประเภท/ปี และทดลองซิงก์ซ้ำว่าไม่เกิดไฟล์ซ้ำ
5. ทดสอบ refresh token และแสดงข้อผิดพลาดเมื่อหมดอายุ/ถูกถอนสิทธิ์ แอป External ใน Testing อาจต้องเชื่อมใหม่หลัง 7 วันตามเงื่อนไข Google
6. โฟลเดอร์หลักมี anyone reader ณ วันที่ตรวจ ห้ามใช้เก็บชุดสำรองข้อมูลส่วนตัวทั้งหมดจนกว่าจะเลือกโฟลเดอร์สำรองที่เป็นส่วนตัว หรือเจ้าของปรับการแชร์อย่างตั้งใจ

เอกสาร Google: https://developers.google.com/workspace/drive/api/guides/api-specific-auth

Google Picker: https://developers.google.com/workspace/drive/picker/guides/overview
