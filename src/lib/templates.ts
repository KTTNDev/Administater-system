export const templates = [
  { id: "external", name: "หนังสือภายนอก", group: "หนังสือภายนอก", description: "ติดต่อระหว่างส่วนราชการ หรือถึงบุคคลภายนอก", source: "DLA", mark: true },
  { id: "internal", name: "หนังสือภายใน", group: "หนังสือภายใน", description: "บันทึกข้อความ ติดต่อภายในกระทรวง ทบวง กรม หรือจังหวัดเดียวกัน", source: "DLA", mark: true },
  { id: "stamped", name: "หนังสือประทับตรา", group: "หนังสือประทับตรา", description: "งานประจำตามเงื่อนไขการใช้หนังสือประทับตรา", source: "DLA", mark: true },
  { id: "order", name: "คำสั่ง", group: "หนังสือสั่งการ", description: "สั่งให้ปฏิบัติโดยชอบด้วยกฎหมาย", source: "REGULATION", mark: true },
  { id: "regulation", name: "ระเบียบ", group: "หนังสือสั่งการ", description: "วางหลักปฏิบัติงานเป็นการประจำ", source: "REGULATION", mark: true },
  { id: "rule", name: "ข้อบังคับ", group: "หนังสือสั่งการ", description: "กำหนดให้ใช้โดยอาศัยอำนาจของกฎหมาย", source: "REGULATION", mark: true },
  { id: "announcement", name: "ประกาศ", group: "หนังสือประชาสัมพันธ์", description: "ประกาศ ชี้แจง หรือแนะแนวทางให้ทราบ", source: "REGULATION", mark: true },
  { id: "statement", name: "แถลงการณ์", group: "หนังสือประชาสัมพันธ์", description: "ทำความเข้าใจในกิจการหรือเหตุการณ์", source: "REGULATION", mark: true },
  { id: "news", name: "ข่าว", group: "หนังสือประชาสัมพันธ์", description: "เผยแพร่ข่าวสารของส่วนราชการ", source: "REGULATION", mark: false },
  { id: "certificate", name: "หนังสือรับรอง", group: "หลักฐานในราชการ", description: "รับรองบุคคล นิติบุคคล หรือข้อเท็จจริง", source: "REGULATION", mark: true },
  { id: "minutes", name: "รายงานการประชุม", group: "หลักฐานในราชการ", description: "บันทึกความคิดเห็น ผู้เข้าร่วม และมติที่ประชุม", source: "REGULATION", mark: false },
  { id: "memorandum", name: "บันทึก", group: "หลักฐานในราชการ", description: "ข้อความเสนอผู้บังคับบัญชา สั่งการ หรือติดต่อเจ้าหน้าที่", source: "REGULATION", mark: false },
  { id: "other", name: "หนังสืออื่น", group: "หลักฐานในราชการ", description: "เอกสารหลักฐานตามลักษณะงาน ต้องกำหนดแบบเฉพาะเพิ่มเติม", source: "CUSTOM", mark: false },
] as const;
export type DocumentType = typeof templates[number]["id"];
export const template = (id: DocumentType) => templates.find(t => t.id === id)!;
export const groups = [...new Set(templates.map(t => t.group))];
export const organizations = [
  { name: "สำนักงานเทศบาล (ตัวอย่าง)", department: "สำนักปลัดเทศบาล", address: "อำเภอเมือง จังหวัดตัวอย่าง 10000", phone: "0 2000 0000", prefix: "ทส 0000" },
  { name: "องค์การบริหารส่วนตำบล (ตัวอย่าง)", department: "สำนักงานปลัด", address: "อำเภอเมือง จังหวัดตัวอย่าง 10000", phone: "0 2000 0000", prefix: "ทส 0000" },
  { name: "องค์การบริหารส่วนจังหวัด (ตัวอย่าง)", department: "กองยุทธศาสตร์และงบประมาณ", address: "อำเภอเมือง จังหวัดตัวอย่าง 10000", phone: "0 2000 0000", prefix: "ทส 0000" },
];
export const layout = { widthMm: 210, heightMm: 297, leftMm: 30, rightMm: 20, topMm: 25, bottomMm: 20, fontPt: 16, indentMm: 25, garudaMm: 30, memoGarudaMm: 15 };
