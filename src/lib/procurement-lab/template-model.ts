export type TemplateSlot={key:string;label:string;group:string;max:number;targets:{p:number;nodes?:number[];parentheses?:boolean;prefix?:string}[];multiline?:boolean};
const one=(p:number,nodes?:number[],parentheses=false)=>({p,nodes,parentheses});
export const templateSlots:TemplateSlot[]=[
  {key:"department",label:"ส่วนราชการและโทรศัพท์",group:"หัวหนังสือ",max:160,targets:[one(2,[1,2,3,4])]},
  {key:"number",label:"เลขหนังสือ",group:"หัวหนังสือ",max:40,targets:[one(3,[2,3])]},
  {key:"day",label:"วันที่ (วัน)",group:"หัวหนังสือ",max:2,targets:[one(3,[5])]},
  {key:"month",label:"เดือน",group:"หัวหนังสือ",max:12,targets:[one(3,[6])]},
  {key:"year",label:"ปี พ.ศ.",group:"หัวหนังสือ",max:4,targets:[one(3,[7])]},
  {key:"subject",label:"เรื่อง",group:"หัวหนังสือ",max:100,targets:[one(4,[1])]},
  {key:"recipient",label:"เรียน",group:"หัวหนังสือ",max:80,targets:[one(5,[2,3])]},
  {key:"directorRecipient",label:"เรียน (ส่วนความเห็นผู้อำนวยการกอง)",group:"หัวหนังสือ",max:80,targets:[{...one(32,[1]),prefix:"เรียน "},{...one(41,[1]),prefix:"เรียน "}]},
  {key:"secretaryRecipient",label:"เรียน (ส่วนความเห็นปลัด)",group:"หัวหนังสือ",max:80,targets:[{...one(69),prefix:"เรียน "},{...one(79),prefix:"เรียน "}]},
  {key:"intro",label:"ข้อความรายงานผล",group:"เนื้อหาและราคา",max:300,targets:[one(6)]},
  {key:"item",label:"รายการพิจารณา",group:"เนื้อหาและราคา",max:110,targets:[one(11)]},
  {key:"vendor",label:"รายชื่อผู้ยื่นข้อเสนอ",group:"เนื้อหาและราคา",max:70,targets:[one(12)]},
  {key:"offered",label:"ราคาที่เสนอ (บาท)",group:"เนื้อหาและราคา",max:14,targets:[one(13)]},
  {key:"agreed",label:"ราคาที่ตกลง / ยอดรวมทั้งบิล (บาท)",group:"เนื้อหาและราคา",max:14,targets:[one(14),one(20)]},
  {key:"consideration",label:"เกณฑ์และผลการพิจารณา",group:"เนื้อหาและราคา",max:450,targets:[one(23)]},
  {key:"proposal",label:"ข้อความเสนออนุมัติ",group:"เนื้อหาและราคา",max:350,targets:[one(24)]},
  {key:"proposer",label:"ชื่อผู้เสนอ (รวมคำนำหน้า)",group:"ผู้ลงนาม",max:60,targets:[one(29,[1])]},
  {key:"proposerPosition",label:"ตำแหน่งผู้เสนอ",group:"ผู้ลงนาม",max:85,targets:[one(30)]},
  {key:"director",label:"ชื่อผู้อำนวยการกอง (รวมคำนำหน้า)",group:"ผู้ลงนาม",max:60,targets:[one(38,undefined,true),one(47,undefined,true)]},
  {key:"directorPosition",label:"ตำแหน่งผู้อำนวยการกอง",group:"ผู้ลงนาม",max:85,targets:[one(39),one(48)]},
  {key:"secretary",label:"ชื่อปลัด / ผู้ปฏิบัติราชการแทน (รวมคำนำหน้า)",group:"ผู้ลงนาม",max:60,targets:[one(75,[1,2]),one(85,[1,2])]},
  {key:"secretaryPosition",label:"ตำแหน่งปลัด (บรรทัดแรก)",group:"ผู้ลงนาม",max:80,targets:[one(76),one(86)]},
  {key:"secretaryActing",label:"ตำแหน่งปลัด (บรรทัดถัดไป)",group:"ผู้ลงนาม",max:70,targets:[one(77),one(87)]},
  {key:"authority",label:"ชื่อผู้มีอำนาจ (รวมคำนำหน้า)",group:"ผู้ลงนาม",max:60,targets:[one(56,[1,2]),one(65,[1,2])]},
  {key:"authorityPosition",label:"ตำแหน่งผู้มีอำนาจ (บรรทัดแรก)",group:"ผู้ลงนาม",max:80,targets:[one(57),one(66)]},
  {key:"authorityActing",label:"ตำแหน่งผู้มีอำนาจ (บรรทัดถัดไป)",group:"ผู้ลงนาม",max:70,targets:[one(58),one(67)]},
];
export type TemplateValues=Record<string,string>;
export const templateOutputVersion="D07-black-v2";
