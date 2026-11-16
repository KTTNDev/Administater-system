/** Placeholders are examples only. Never copy these strings into ProcurementInput. */
const examples:Record<string,string>={
 vendor:'ร้านตัวอย่างการค้า',item:'วัสดุสำนักงาน จำนวน 2 รายการ',offered:'1,500.00',agreed:'1,400.00',
 vendorAddress:'99 ถนนตัวอย่าง ตำบล… อำเภอ… จังหวัด…',vendorTaxId:'0123456789012',vendorPhone:'02-000-0000',vendorContact:'นายสมมติ ตัวอย่าง',vendorPosition:'ผู้จัดการ',
 organization:'เทศบาลตัวอย่าง',unit:'กองสวัสดิการสังคม',department:'งานธุรการ กอง… โทร.…',organizationAddress:'99 ถนนตัวอย่าง อำเภอ… จังหวัด…',organizationPhone:'02-000-0000',
 category:'วัสดุสำนักงาน',budgetYear:'2570',allocatedBudget:'30,000.00',remainingBudget:'28,500.00',referencePrice:'1,500.00',
 orderNumber:'เลขใบสั่งจริง/0001',appointmentNumber:'เลขคำสั่งจริง/0001',egpNumber:'เลขโครงการตามหน้าระบบ',deliveryDays:'3',deliveryPlace:'สำนักงานตามสัญญา',penalty:'อัตราค่าปรับตามสัญญาที่ตรวจแล้ว',
 proposer:'นายสมมติ ตัวอย่าง',director:'นางสมมติ ตัวอย่าง',secretary:'นายสมมติ ตัวอย่าง',authority:'นายสมมติ ตัวอย่าง',inspector:'นายสมมติ ตัวอย่าง',
 proposerPosition:'เจ้าพนักงานธุรการ',directorPosition:'ผู้อำนวยการกอง…',secretaryPosition:'ปลัด…',secretaryActing:'ตำแหน่งปฏิบัติราชการแทน (เมื่อมี)',authorityPosition:'นายก…',authorityActing:'ตำแหน่งปฏิบัติราชการแทน (เมื่อมี)',inspectorPosition:'ตำแหน่งตามคำสั่งแต่งตั้ง',
 recipient:'ผู้รับหนังสือตามสายงานจริง',directorRecipient:'ตำแหน่งผู้รับความเห็น',secretaryRecipient:'ตำแหน่งผู้รับความเห็น',number:'รหัสหน่วยงาน/0001',subject:'ชื่อเรื่องที่ใช้กับงานนี้',billNumber:'QT-0001',title:'จัดซื้อวัสดุสำนักงาน',notes:'รายละเอียดเพิ่มเติมของงานนี้',
};
export function procurementPlaceholder(key:string){if(key==='allocatedBudgetWords')return 'คำนวณจากวงเงินตัวเลขอัตโนมัติ';return examples[key]?'ตัวอย่าง: '+examples[key]:'กรอกข้อมูลจริง';}
export const placeholderNotice='ข้อความสีจางที่ขึ้นต้น “ตัวอย่าง:” หรือ “เช่น” เป็นเพียงแนวทาง ต้องกรอกข้อมูลจริงเอง ตัวอย่างจะไม่ถูกบันทึกหรือพิมพ์ลงเอกสาร';
