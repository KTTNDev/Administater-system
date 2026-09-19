import {templates,type DocumentType} from './templates';
export type SearchDestination='budget'|'dashboard'|'templates'|'settings'|'guide'|'office'|'bookings'|'calendar'|'laws'|'reports';
export type WorkAction={id:string;title:string;description:string;view:SearchDestination;documentType?:DocumentType;terms:string[]};
export const workActions:WorkAction[]=[
 {id:'budget',title:'โอนงบประมาณ',description:'จัดทำคำขอโอนลด–โอนเพิ่ม เลือกครุภัณฑ์และอ้างระเบียบ',view:'budget',terms:['โอนงบ','โอนลด','โอนเพิ่ม','งบประมาณ','ซื้อคอม','ซื้ออุปกรณ์','ครุภัณฑ์','ราคามาตรฐาน']},
 {id:'bookings',title:'จองห้องประชุม',description:'เลือกห้องและช่วงเวลา ตรวจตารางการจอง',view:'bookings',terms:['จองห้อง','ห้องประชุม','ห้องว่าง','จองประชุม','สถานที่ประชุม','ประชุม']},
 {id:'calendar',title:'ปฏิทินและนัดหมาย',description:'ลงนัดประชุม ศึกษาดูงาน และเชื่อมหนังสือที่เกี่ยวข้อง',view:'calendar',terms:['นัดประชุม','นัดหมาย','ปฏิทิน','ศึกษาดูงาน','ตารางงาน','วันนี้','พรุ่งนี้','ประชุม','แนบหนังสือ']},
 {id:'laws',title:'คลังกฎหมายและระเบียบ',description:'ค้นหา อ่าน เก็บไฟล์กฎหมายและบันทึกโน้ต',view:'laws',terms:['กฎหมาย','ระเบียบ','คลังกฎหมาย','อ่านกฎหมาย','ข้อกฎหมาย','ค้นระเบียบ','อ้างอิง','โน้ต','กฏหมาย']},
 {id:'documents',title:'ค้นหาเอกสารในทะเบียน',description:'ค้นหนังสือจากเรื่อง เลขที่ หน่วยงาน และเนื้อหา',view:'dashboard',terms:['ค้นหนังสือ','ค้นหาเอกสาร','หาเอกสาร','หนังสือเก่า','ทะเบียน','เลขที่','ค้นหาเรื่อง','ประวัติหนังสือ']},
 {id:'office',title:'งานธุรการเทศบาล',description:'จัดการงานรับ–ส่งหนังสือและติดตามงานธุรการ',view:'office',terms:['ธุรการ','หนังสือเข้า','หนังสือออก','รับหนังสือ','ส่งหนังสือ','ติดตามงาน','รับส่ง']},
 {id:'reports',title:'ภาพรวมและรายงาน',description:'ดูสถิติเอกสาร ปฏิทิน ห้องประชุม และการใช้งาน',view:'reports',terms:['รายงาน','สถิติ','ภาพรวม','แดชบอร์ด','สรุปงาน','จำนวนหนังสือ']},
 {id:'drive',title:'เชื่อมและซิงก์ Google Drive',description:'เปิดตั้งค่าเพื่อเชื่อมบัญชี ทดสอบ และอัปโหลดข้อมูล',view:'settings',terms:['drive','google','ไดรฟ์','ไดร์ฟ','ไดร์','ซิงก์','ซิงค์','sync','อัปโหลด','อัพโหลด','คลาวด์']},
 {id:'backup',title:'สำรองและกู้คืนข้อมูล',description:'ส่งออกชุดสำรอง ตรวจไฟล์ และกู้สำเนาลงโฟลเดอร์ใหม่',view:'settings',terms:['สำรอง','กู้คืน','ข้อมูลหาย','กู้ข้อมูล','backup','restore','คืนข้อมูล']},
 {id:'storage',title:'ตั้งค่าพื้นที่เก็บไฟล์',description:'ดูหรือเปลี่ยนตำแหน่งโฟลเดอร์บนเครื่อง',view:'settings',terms:['โฟลเดอร์','เก็บไฟล์','ตำแหน่งไฟล์','พาธ','local','ที่เก็บ']},
 {id:'organization',title:'ตั้งค่าหน่วยงาน',description:'บันทึกชื่อ ที่อยู่และข้อมูลส่วนราชการสำหรับกรอกอัตโนมัติ',view:'settings',terms:['ตั้งค่า','หน่วยงาน','ที่อยู่','ส่วนราชการ','กรอกอัตโนมัติ']},
 {id:'templates',title:'เลือกแบบหนังสือราชการ',description:'ดูแบบหนังสือทุกประเภทก่อนเริ่มร่าง',view:'templates',terms:['ทำหนังสือ','สร้างหนังสือ','ร่างหนังสือ','แบบฟอร์ม','เทมเพลต','หนังสือราชการ']},
 ...templates.map(t=>({id:'create-'+t.id,title:'ร่าง'+t.name,description:t.description,view:'templates' as const,documentType:t.id,terms:[t.name,...(t.id==='internal'?['บันทึกข้อความ','หนังสือภายใน']:t.id==='external'?['หนังสือภายนอก','หนังสือเชิญ']:t.id==='minutes'?['รายงานการประชุม','บันทึกมติ','ประชุม']:[])]})),
 {id:'guide',title:'คู่มือและแหล่งอ้างอิง',description:'ดูคำแนะนำรูปแบบเอกสารและขอบเขตการใช้งาน',view:'guide',terms:['คู่มือ','วิธีใช้','ใช้งานยังไง','ช่วยเหลือ','รูปแบบเอกสาร']},
];
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
export function searchWorkActions(query:string){
 const q=normalize(query).slice(0,250);if(!q)return workActions.slice(0,6).map(action=>({action,score:0,matched:[]}));
 return workActions.map(action=>{
  const matched=action.terms.filter(term=>q.includes(normalize(term)));
  const longest=Math.max(0,...matched.map(t=>normalize(t).length));
  const exact=normalize(action.title)===q?100:0;
  const partial=q.length>=3&&normalize(action.title).includes(q)?q.length*2:0;
  return {action,matched,score:exact+longest*4+matched.length+partial};
 }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.action.id.localeCompare(b.action.id)).slice(0,8);
}
