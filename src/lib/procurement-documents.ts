import {templateSlots,templateOutputVersion,type TemplateSlot} from './procurement-lab/template-model';
import {extraDocumentTemplates} from './procurement-suite-definitions';
import {procurementDocumentNames} from './procurement-document-types';
const target=(p:number,nodes?:number[],parentheses=false,prefix?:string)=>({p,nodes,parentheses,prefix});
const field=(key:string,label:string,group:string,max:number,targets:TemplateSlot['targets']):TemplateSlot=>({key,label,group,max,targets});
export const d01Slots:TemplateSlot[]=[
 field('department','ส่วนราชการและโทรศัพท์','หัวหนังสือ',160,[target(2,[1,2,3,4])]),
 field('number','เลขหนังสือ D01','หัวหนังสือ',40,[target(3,[2,3,4])]),
 field('day','วันที่ (วัน) D01','หัวหนังสือ',2,[target(3,[6])]),field('month','เดือน D01','หัวหนังสือ',12,[target(3,[7])]),field('year','ปี พ.ศ. D01','หัวหนังสือ',4,[target(3,[8])]),
 field('subject','เรื่อง D01','หัวหนังสือ',140,[target(4,[1])]),field('recipient','เรียน','หัวหนังสือ',80,[target(5,[2,3])]),
 field('background','เรื่องเดิม / รายละเอียดงบประมาณ','เนื้อหา D01',600,[target(7)]),
 field('facts','ข้อเท็จจริง','เนื้อหา D01',450,[target(9)]),field('necessity','เหตุผลและความจำเป็น','เนื้อหา D01',400,[target(10)]),
 field('legalBasis','ข้อระเบียบและกฎหมายที่ตรวจแล้ว','เนื้อหา D01',500,[target(12)]),
 field('proposalIntro','ข้อความนำข้อพิจารณาและข้อเสนอ','เนื้อหา D01',300,[target(14)]),field('methodHeading','หัวข้อแนวทางดำเนินการ','เนื้อหา D01',140,[target(15)]),
 field('approval1','ข้อเสนอที่ 1','เนื้อหา D01',240,[target(16,undefined,false,'1. ')]),field('approval2','ข้อเสนอที่ 2 (เว้นว่างได้)','เนื้อหา D01',240,[target(17,undefined,false,'2. ')]),
 field('approval3','ข้อเสนอที่ 3 (เว้นว่างได้)','เนื้อหา D01',240,[target(18,undefined,false,'3. ')]),field('approval4','ข้อเสนอที่ 4 (เว้นว่างได้)','เนื้อหา D01',240,[target(19,undefined,false,'4. ')]),
 field('closing','ข้อความท้ายบันทึก','เนื้อหา D01',240,[target(20)]),
 field('proposer','ชื่อผู้เสนอ','ผู้ลงนาม',60,[target(24,undefined,true)]),field('proposerPosition','ตำแหน่งผู้เสนอ','ผู้ลงนาม',85,[target(25,[8,9])]),
 field('directorRecipient','เรียนในส่วนความเห็นผู้อำนวยการกอง','ผู้ลงนาม',80,[target(26,undefined,false,'เรียน '),target(35,undefined,false,'เรียน ')]),
 field('director','ชื่อผู้อำนวยการกอง','ผู้ลงนาม',60,[target(33,undefined,true),target(42,undefined,true)]),field('directorPosition','ตำแหน่งผู้อำนวยการกอง','ผู้ลงนาม',85,[target(34),target(43)]),
 field('secretaryRecipient','เรียนในส่วนความเห็นปลัด','ผู้ลงนาม',80,[target(45,undefined,false,'เรียน '),target(54,undefined,false,'เรียน ')]),
 field('secretary','ชื่อปลัด / ผู้ปฏิบัติราชการแทน','ผู้ลงนาม',60,[target(51,undefined,true),target(60,undefined,true)]),field('secretaryPosition','ตำแหน่งปลัดบรรทัดแรก','ผู้ลงนาม',80,[target(52),target(61)]),field('secretaryActing','ตำแหน่งปลัดบรรทัดถัดไป','ผู้ลงนาม',70,[target(53),target(62)]),
 field('authority','ชื่อผู้มีอำนาจ','ผู้ลงนาม',60,[target(71,undefined,true),target(81,undefined,true)]),field('authorityPosition','ตำแหน่งผู้มีอำนาจบรรทัดแรก','ผู้ลงนาม',80,[target(72),target(82)]),field('authorityActing','ตำแหน่งผู้มีอำนาจบรรทัดถัดไป','ผู้ลงนาม',70,[target(73),target(83)]),
];
export const d01OwnKeys=['number','day','month','year','subject','background','facts','necessity','legalBasis','proposalIntro','methodHeading','approval1','approval2','approval3','approval4','closing'] as const;
export const emptyD01=()=>Object.fromEntries(d01OwnKeys.map(key=>[key,'']));
export const d01Optional=['subject','approval2','approval3','approval4','secretaryActing','authorityActing'];
export const documentTemplates={
 ...Object.fromEntries(Object.entries(extraDocumentTemplates).map(([code,definition])=>[code,{...definition,name:procurementDocumentNames[code as keyof typeof procurementDocumentNames],slots:[] as TemplateSlot[]}])) as Record<keyof typeof extraDocumentTemplates,{name:string;sha256:string;outputVersion:string;slots:TemplateSlot[]}>,
 D01:{name:'บันทึกขออนุมัติจัดซื้อจัดจ้าง',sha256:'4f21b2a9c2620a97aa0081a801da45e2524ce08ae4d38b431491220e785f7e41',outputVersion:'D01-correspondence-v2',slots:d01Slots},
 D07:{name:'รายงานพิจารณาผล',sha256:'3b6d0541a216951bf48f0e51f8c227aa34ab947f8ab6646083bd4fc818a7ef31',outputVersion:'D07-correspondence-v2',slots:templateSlots},
} as const;
export type DraftDocumentCode=keyof typeof documentTemplates;
const both='ชุดเอกสารที่ใช้บทบาทนี้';
export const commonFieldUsage:Record<string,string>={
 department:both+' · บรรทัดส่วนราชการและโทรศัพท์',number:'D07 · เลขหนังสือด้านบน (D01 กรอกเลขแยกในแท็บเอกสาร)',
 day:'D07 · วันที่หนังสือด้านบน',month:'D07 · เดือนของหนังสือด้านบน',year:'D07 · ปีของหนังสือด้านบน',subject:'D07 · บรรทัดเรื่อง (D01 มีชื่อเรื่องแยก)',recipient:both+' · บรรทัดเรียนด้านบน',
 directorRecipient:both+' · เรียนในส่วนความเห็นผู้อำนวยการกอง; เว้นว่างใช้ตำแหน่งปลัด',secretaryRecipient:both+' · เรียนในส่วนความเห็นปลัด; เว้นว่างใช้ตำแหน่งผู้มีอำนาจ',
 intro:'D07 · ย่อหน้ารายงานผลก่อนตาราง',item:'D01–D14 · หัวเรื่อง เนื้อหา และตารางที่อ้างรายการ; รายการแยกแถวอยู่ใน D04/D05/D07/D09',vendor:'D07–D14 · คู่สัญญา ผู้ชนะ ผู้รับใบสั่ง และผู้รับเงิน ในฉบับที่อ้างชื่อร้านค้า',
 offered:'D07 · ราคาเสนอแต่ละรายการ; D05 เมื่อยืนยันใช้ราคาเสนอเป็นราคาอ้างอิง',agreed:'D05/D07–D14 ในฉบับที่แสดงวงเงิน · ยอดจากบิลและ VAT ตามรูปแบบที่กรอก',consideration:'D07 · ย่อหน้าผลการพิจารณาใต้ตาราง',proposal:'D07 · ย่อหน้าเสนออนุมัติก่อนลงนาม',
 proposer:both+' · ชื่อผู้เสนอใต้เนื้อหา',proposerPosition:both+' · ตำแหน่งใต้ชื่อผู้เสนอ',director:both+' · ชื่อในชุดลงนามผู้อำนวยการกอง',directorPosition:both+' · ตำแหน่งใต้ชื่อผู้อำนวยการกอง',
 secretary:both+' · ชื่อในชุดลงนามปลัด / ผู้ปฏิบัติราชการแทน',secretaryPosition:both+' · ตำแหน่งปลัดบรรทัดแรก และค่าเริ่มต้นข้อความเรียนในส่วนความเห็นผู้อำนวยการกอง',secretaryActing:both+' · ตำแหน่งปลัดบรรทัดถัดไป',
 authority:both+' · ชื่อในชุดลงนามผู้มีอำนาจ',authorityPosition:both+' · ตำแหน่งผู้มีอำนาจบรรทัดแรก และค่าเริ่มต้นข้อความเรียนในส่วนความเห็นปลัด',authorityActing:both+' · ตำแหน่งผู้มีอำนาจบรรทัดถัดไป',
};
export const caseFieldUsage={title:'รายการงานและชื่อเรื่องภายในระบบ ไม่พิมพ์ลงเอกสารโดยอัตโนมัติ',kind:'แยกประเภทงาน และใช้ตั้งชื่อเรื่อง D01 เมื่อเว้นชื่อเรื่องว่าง',profile:'กำกับแนวทางและคำเตือน ข้อระเบียบตั้งต้นต้องตรวจให้ตรงแนวทางที่เลือก',egpExemption:'ข้อมูลกำกับการใช้ e-GP ในระบบ ไม่ใช่วิธีจัดซื้อจัดจ้าง',billType:'ข้อมูลกำกับหลักฐานและคำเตือนลำดับงาน ยังไม่พิมพ์ใน D01/D07',billNumber:'ข้อมูลอ้างอิงบิลในระบบ ยังไม่พิมพ์ใน D01/D07',contractDue:'เรียงงานตามกำหนดสัญญา ยังไม่พิมพ์ใน D01/D07',notes:'บันทึกภายในงาน ยังไม่พิมพ์ใน D01/D07'};
const additionalUsage:Record<string,string>={referencePrice:'D05 · ราคากลาง / ราคาอ้างอิงที่เจ้าหน้าที่ตรวจแล้ว',category:'D01–D05 · ประเภทพัสดุและงบประมาณ',vendorAddress:'D09/D13 · ที่อยู่คู่สัญญา',vendorTaxId:'D09/D10/D13 · เลขผู้เสียภาษี',vendorPhone:'D09/D13 · ติดต่อร้านค้า',vendorContact:'D09 · ผู้รับใบสั่ง',vendorPosition:'D09 · ตำแหน่งผู้รับใบสั่ง',organizationAddress:'D09 · ที่อยู่หน่วยงาน',orderNumber:'D09–D13 · หากกำหนดเลขเฉพาะ D09 จะใช้ค่านั้นอ้างอิงก่อนช่องกลาง',orderDate:'D09–D13 · หาก D09 ระบุวันที่เฉพาะ จะใช้วันที่นั้นก่อนช่องกลาง',appointmentNumber:'D06/D12 · ใช้เลขเฉพาะ D06 ก่อนเมื่อมี',appointmentDate:'D06/D12 · ใช้วันที่เฉพาะ D06 ก่อนเมื่อมี',egpNumber:'D10 · เลขโครงการ e-GP',deliveryDays:'D04/D05/D09 · ระยะเวลาส่งมอบ',deliveryPlace:'D04/D09 · สถานที่ส่งมอบ',deliveryDate:'D12/D13 · วันที่ส่งมอบจริง',inspectionDate:'D11–D13 · วันที่ตรวจรับจริง',inspector:'D05/D06/D11/D12 · ผู้ตรวจรับ',inspectorPosition:'D05/D06/D12 · ตำแหน่งผู้ตรวจรับ',remainingBudget:'D04/D05/D14 · งบคงเหลือตามข้อมูลจริง'};
export const additionalCommonFields=[
 ...[
 ['referencePrice','ราคากลาง / ราคาอ้างอิงที่ตรวจแล้ว'],['category','ประเภทวัสดุ / ลักษณะงาน'],['vendorAddress','ที่อยู่ร้านค้า'],['vendorTaxId','เลขผู้เสียภาษีร้านค้า'],['vendorPhone','โทรศัพท์ร้านค้า'],['vendorContact','ผู้รับใบสั่ง / ผู้แทนร้านค้า'],['vendorPosition','ตำแหน่งผู้แทนร้านค้า'],['organizationAddress','ที่อยู่หน่วยงาน'],['organizationPhone','โทรศัพท์หน่วยงาน'],['orderNumber','เลขใบสั่งซื้อ / จ้าง'],['orderDate','วันที่ใบสั่งซื้อ / จ้าง'],['appointmentNumber','เลขคำสั่งแต่งตั้งผู้ตรวจรับ'],['appointmentDate','วันที่คำสั่งแต่งตั้ง'],['egpNumber','เลขโครงการ e-GP'],['deliveryDays','จำนวนวันส่งมอบตามสัญญา'],['deliveryPlace','สถานที่ส่งมอบ'],['deliveryDate','วันที่ส่งมอบจริง'],['inspectionDate','วันที่ตรวจรับจริง'],['inspector','ชื่อผู้ตรวจรับ'],['inspectorPosition','ตำแหน่งผู้ตรวจรับ'],['remainingBudget','งบประมาณคงเหลือ'],['penalty','ข้อความอัตราค่าปรับตามสัญญา'],
 ].map(([key,label])=>({key,label,max:240,usage:additionalUsage[key]||'D04/D09 · เงื่อนไขตามสัญญา'})),
 {key:'organization',label:'ชื่อหน่วยงาน',max:100,usage:'D07 · ข้อความพิจารณา และข้อความที่ผูกชื่อหน่วยงาน'},
 {key:'unit',label:'ชื่อกอง / ส่วนงาน',max:100,usage:'D01 · เรื่องเดิมและข้อเท็จจริงที่ผูกชื่อกอง'},
 {key:'budgetYear',label:'ปีงบประมาณ',max:4,usage:'D01 · เรื่องเดิม / งบประมาณ ไม่ใช่ปีของวันที่หนังสือ'},
 {key:'allocatedBudget',label:'วงเงินงบประมาณตั้งไว้ (บาท)',max:20,usage:'D01 · เรื่องเดิม เป็นงบตั้งไว้ แยกจากราคาที่ตกลงกับร้าน'},
 {key:'allocatedBudgetWords',label:'วงเงินงบประมาณตั้งไว้ (ตัวอักษร)',max:240,usage:'D01 · วงเล็บจำนวนเงินในเรื่องเดิม'},
];
