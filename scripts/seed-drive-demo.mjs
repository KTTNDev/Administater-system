import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const databasePath = path.resolve(process.cwd(), process.env.DATABASE_PATH || "data/sarabun.sqlite");
const connection = new DatabaseSync(databasePath);
connection.exec("PRAGMA journal_mode = WAL");
connection.exec("PRAGMA busy_timeout = 5000");

const common = {
  date: "2026-09-12",
  organization: "เทศบาลตำบลตัวอย่าง",
  department: "สำนักปลัดเทศบาล",
  address: "99 หมู่ 1 ตำบลตัวอย่าง อำเภอเมือง จังหวัดตัวอย่าง 10000",
  phone: "0 2000 0000",
  email: "saraban@example.go.th",
  numeralStyle: "thai",
  yearMode: "fiscal",
  status: "reviewed",
  signer: "นายทดสอบ ระบบสารบรรณ",
  position: "นายกเทศมนตรีตำบลตัวอย่าง",
  salutation: "เรียน",
  closing: "ขอแสดงความนับถือ",
};

const demos = [
  {
    type: "external",
    driveFileId: "1M0a97mjEikKTOtbsMBCKyOQPcA6RI49f",
    subject: "ขอความอนุเคราะห์ข้อมูลเพื่อจัดทำแผนพัฒนาท้องถิ่น (ข้อมูลสาธิต)",
    number: "ทส 0001/001",
    recipient: "นายอำเภอเมืองตัวอย่าง",
    body: "ด้วยเทศบาลตำบลตัวอย่างอยู่ระหว่างรวบรวมข้อมูลเพื่อประกอบการจัดทำแผนพัฒนาท้องถิ่น จึงขอความอนุเคราะห์ข้อมูลที่เกี่ยวข้องภายในระยะเวลาที่กำหนด\n\nจึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์",
    urgency: "ด่วน",
    copies: "ปลัดเทศบาลตำบลตัวอย่าง",
  },
  {
    type: "internal",
    driveFileId: "1PU0HL_0aEY1ZVsU9ZGYX0YpPOZm9Xv25",
    subject: "รายงานผลการตรวจสอบเอกสารประจำเดือน (ข้อมูลสาธิต)",
    number: "ทส 0001/002",
    recipient: "ปลัดเทศบาลตำบลตัวอย่าง",
    bodyMode: "structured",
    background: "ตามที่ได้รับมอบหมายให้ตรวจสอบความครบถ้วนของเอกสารประจำเดือนนั้น",
    legalBasis: "ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. 2526 และที่แก้ไขเพิ่มเติม",
    consideration: "ตรวจสอบแล้วเอกสารส่วนใหญ่ครบถ้วน และมีรายการที่ต้องแก้ไขตามรายละเอียดแนบ",
    proposal: "จึงเรียนมาเพื่อโปรดทราบและพิจารณาสั่งการ",
    proposers: [
      { name: "นางสาวผู้เสนอ หนึ่ง", position: "นักจัดการงานทั่วไปชำนาญการ" },
      { name: "นายผู้เสนอ สอง", position: "หัวหน้าฝ่ายอำนวยการ" },
    ],
    opinions: [
      { title: "ความเห็นหัวหน้าสำนักปลัด", comment: "เห็นควรดำเนินการตามข้อเสนอ", name: "นางหัวหน้า สำนักปลัด", position: "หัวหน้าสำนักปลัดเทศบาล", lines: 3 },
      { title: "ความเห็นปลัดเทศบาล", comment: "เห็นชอบ", name: "นายปลัด เทศบาล", position: "ปลัดเทศบาล", lines: 3 },
      { title: "ความเห็นรองนายกเทศมนตรี", comment: "เห็นควรเสนอผู้บริหาร", name: "นายรอง นายก", position: "รองนายกเทศมนตรี", lines: 2 },
      { title: "คำสั่งนายกเทศมนตรี", comment: "อนุมัติ ให้ดำเนินการ", name: "นายทดสอบ ระบบสารบรรณ", position: "นายกเทศมนตรี", lines: 2 },
    ],
  },
  {
    type: "stamped",
    driveFileId: "1RmUZkk0aQgTwsWgKcjvJjJiwaQKLP3hu",
    subject: "ส่งสำเนารายงานผลการดำเนินงาน (ข้อมูลสาธิต)",
    number: "ทส 0001/003",
    recipient: "ผู้อำนวยการกองทุกกอง",
    body: "เทศบาลตำบลตัวอย่างขอส่งสำเนารายงานผลการดำเนินงานเพื่อใช้ประกอบการปฏิบัติราชการ รายละเอียดตามสิ่งที่ส่งมาด้วย",
    copyMark: "สำเนา",
    productionMark: true,
    drafter: "เจ้าหน้าที่สาธิต",
    typist: "เจ้าหน้าที่สาธิต",
    checker: "หัวหน้าฝ่ายสาธิต",
  },
  {
    type: "order",
    driveFileId: "1z213PfgxHj1my9MKEyB-DcktrRU1U8tu",
    subject: "แต่งตั้งคณะทำงานพัฒนาระบบงานสารบรรณ (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "เจ้าหน้าที่ผู้ได้รับแต่งตั้ง",
    body: "เพื่อให้การพัฒนาระบบงานสารบรรณเป็นไปด้วยความเรียบร้อย จึงแต่งตั้งคณะทำงานตามรายชื่อแนบท้ายคำสั่งนี้\n\nทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป",
  },
  {
    type: "regulation",
    driveFileId: "1iCAkVrBxu7N2t48OcP7hzk-Lv28OQcxg",
    subject: "ว่าด้วยการจัดเก็บเอกสารอิเล็กทรอนิกส์ พ.ศ. 2569 (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "พนักงานเทศบาลและเจ้าหน้าที่",
    body: "โดยที่เป็นการสมควรกำหนดหลักเกณฑ์การจัดเก็บเอกสารอิเล็กทรอนิกส์ให้เป็นระบบ จึงวางระเบียบไว้ดังต่อไปนี้\n\nข้อ 1 ระเบียบนี้เรียกว่า ระเบียบเทศบาลตำบลตัวอย่างว่าด้วยการจัดเก็บเอกสารอิเล็กทรอนิกส์ พ.ศ. 2569",
    effectiveDate: "2026-10-01",
  },
  {
    type: "rule",
    driveFileId: "1FbFaaR-S-j0472Vaw2c3jl9GjydInz8T",
    subject: "ว่าด้วยการใช้ระบบสารบรรณอิเล็กทรอนิกส์ พ.ศ. 2569 (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "ผู้ใช้งานระบบสารบรรณ",
    body: "อาศัยอำนาจตามกฎหมายและระเบียบที่เกี่ยวข้อง จึงออกข้อบังคับเกี่ยวกับการใช้ระบบสารบรรณอิเล็กทรอนิกส์ไว้ดังต่อไปนี้",
    effectiveDate: "2026-10-01",
  },
  {
    type: "announcement",
    driveFileId: "1COoyj_HbqySn1hxyUWYAdcF_-rIzKhlo",
    subject: "กำหนดวันเปิดให้บริการระบบสารบรรณอิเล็กทรอนิกส์ (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "ประชาชนและผู้เกี่ยวข้อง",
    body: "เทศบาลตำบลตัวอย่างขอประกาศเปิดให้บริการระบบสารบรรณอิเล็กทรอนิกส์ ตั้งแต่วันที่ 1 ตุลาคม 2569 เป็นต้นไป\n\nจึงประกาศให้ทราบโดยทั่วกัน",
  },
  {
    type: "statement",
    driveFileId: "1DtSBecQODSfzlybIeolWZNJS0OZymJ-B",
    subject: "ชี้แจงการปรับปรุงช่องทางรับส่งหนังสือราชการ (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "ประชาชนและส่วนราชการที่เกี่ยวข้อง",
    body: "เทศบาลตำบลตัวอย่างขอชี้แจงว่า การปรับปรุงช่องทางรับส่งหนังสือราชการมีวัตถุประสงค์เพื่อเพิ่มความสะดวก รวดเร็ว และตรวจสอบได้",
  },
  {
    type: "news",
    driveFileId: "1d0w_h8CiD2M7SBWnYmWtLMl5jvli2mM5",
    subject: "เปิดตัวระบบจัดทำและบริหารจัดการร่างหนังสือราชการ (ข้อมูลสาธิต)",
    number: "ข่าว 1/2569",
    recipient: "สื่อมวลชนและประชาชน",
    body: "เทศบาลตำบลตัวอย่างเปิดตัวระบบจัดทำและบริหารจัดการร่างหนังสือราชการ เพื่อช่วยลดขั้นตอนและเพิ่มความถูกต้องในการปฏิบัติงาน",
  },
  {
    type: "certificate",
    driveFileId: "1CaWYZjuoslttHCVaIV7WflqZpFtfT5ZF",
    subject: "รับรองการเข้าร่วมโครงการอบรม (ข้อมูลสาธิต)",
    number: "ทส 0001/004",
    recipient: "ผู้เกี่ยวข้อง",
    body: "หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า นายตัวอย่าง ผู้เข้าร่วม ได้เข้าร่วมโครงการอบรมการใช้งานระบบสารบรรณอิเล็กทรอนิกส์ครบถ้วนตามหลักสูตรจริง",
  },
  {
    type: "minutes",
    driveFileId: "1nN0Z-J1LTGFFzIBJOaWu-fdsQlKpI7ps",
    subject: "รายงานการประชุมคณะทำงานพัฒนาระบบสารบรรณ (ข้อมูลสาธิต)",
    number: "1/2569",
    recipient: "คณะทำงาน",
    meetingNo: "1/2569",
    location: "ห้องประชุมเทศบาลตำบลตัวอย่าง",
    attendees: "นายประธาน ตัวอย่าง\nนางกรรมการ ตัวอย่าง",
    absentees: "ไม่มี",
    participants: "เจ้าหน้าที่งานสารบรรณ",
    startTime: "09.30 น.",
    endTime: "11.30 น.",
    recorder: "นางสาวผู้จด รายงาน",
    body: "ระเบียบวาระที่ 1 เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ\nที่ประชุมรับทราบ\n\nระเบียบวาระที่ 2 เรื่องเพื่อพิจารณา\nที่ประชุมมีมติเห็นชอบให้ทดลองใช้ระบบ",
  },
  {
    type: "memorandum",
    driveFileId: "12cgL6nxKtSkPpZdefBZ9TY1wNrU2Ouz2",
    subject: "บันทึกผลการทดสอบระบบจัดเก็บเอกสาร (ข้อมูลสาธิต)",
    number: "บันทึก 1/2569",
    recipient: "หัวหน้าสำนักปลัดเทศบาล",
    body: "ได้ทดสอบการจัดเก็บเอกสารแยกตามประเภทและปีงบประมาณแล้ว ผลการทดสอบเป็นไปด้วยความเรียบร้อย สามารถค้นหาและเปิดเอกสารได้",
    productionMark: true,
    drafter: "เจ้าหน้าที่สาธิต",
    checker: "หัวหน้าฝ่ายสาธิต",
  },
  {
    type: "other",
    driveFileId: "1T8EC3OyW4t3m7ToJ15xOdqYNNnOXlU5W",
    subject: "แบบสรุปการรับส่งเอกสารอิเล็กทรอนิกส์ (ข้อมูลสาธิต)",
    number: "แบบ 1/2569",
    recipient: "หน่วยงานภายใน",
    body: "เอกสารตัวอย่างประเภทหนังสืออื่น ใช้สาธิตแนวทางจัดเก็บไฟล์ที่มีรูปแบบเฉพาะของหน่วยงาน",
  },
];

connection.exec(`CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, drive_file_id TEXT, synced_version INTEGER
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL,
  action TEXT NOT NULL, version INTEGER, at TEXT NOT NULL
);`);

const getExisting = connection.prepare("SELECT version, created_at FROM documents WHERE id = ?");
const insertDocument = connection.prepare("INSERT INTO documents(id,data,version,created_at,updated_at,drive_file_id,synced_version) VALUES(?,?,?,?,?,?,?)");
const updateDocument = connection.prepare("UPDATE documents SET data=?,updated_at=?,drive_file_id=?,synced_version=version WHERE id=?");
const insertAudit = connection.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)");
const now = new Date().toISOString();

connection.exec("BEGIN IMMEDIATE");
try {
  demos.forEach((demo, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const { driveFileId, ...specific } = demo;
    const data = JSON.stringify({ ...common, ...specific });
    const existing = getExisting.get(id);
    if (existing) {
      updateDocument.run(data, now, driveFileId, id);
    } else {
      insertDocument.run(id, data, 1, now, now, driveFileId, 1);
      insertAudit.run(id, "seed", 1, now);
    }
  });
  connection.exec("COMMIT");
} catch (error) {
  connection.exec("ROLLBACK");
  throw error;
} finally {
  connection.close();
}

console.log(JSON.stringify({ success: true, databasePath, count: demos.length }, null, 2));
