import type {ProcurementInput} from './procurement';
import type {ProcurementDocumentCode} from './procurement-document-types';
export const procurementDocumentOrder=['D01','D02','D04','D03','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14'] as const;
export const procurementJourney=[
 {id:'D01',title:'ขออนุมัติจัดซื้อ / จัดจ้าง',code:'D01',hint:'กรอกข้อมูลบิลร่วม ตรวจบันทึกขออนุมัติ และแนบฉบับลงนาม'},
 {id:'D02',title:'ขออนุมัติมอบหมายร่างขอบเขตงาน',code:'D02',hint:'ระบุเลขที่และวันที่หนังสือมอบหมายผู้จัดทำขอบเขตงาน'},
 {id:'D04',title:'ร่างขอบเขตงาน / คุณลักษณะเฉพาะ',code:'D04',hint:'จัดทำ TOR จากรายการเดิม ตรวจรายละเอียดและเงื่อนไขส่งมอบ'},
 {id:'D03',title:'รายงานผลการร่างขอบเขตงาน',code:'D03',hint:'รายงานผลหลังจัดทำร่างขอบเขตแล้ว รหัสเอกสารเดิมยังเป็น D03'},
 {id:'D05',title:'รายงานขอซื้อ / ขอจ้าง',code:'D05',hint:'ตรวจราคาอ้างอิง วิธีดำเนินการ และรายการที่จะขอซื้อหรือจ้าง'},
 {id:'D06',title:'คำสั่งแต่งตั้งผู้ตรวจรับ',code:'D06',hint:'ตรวจผู้ตรวจรับและตำแหน่งตามคำสั่งของงานนี้'},
 {id:'D07',title:'รายงานผลและขออนุมัติสั่งซื้อ / จ้าง',code:'D07',hint:'ใช้ร้านค้า รายการ และยอดจากบิลเดียวกัน ตรวจข้อเสนอและผู้อนุมัติ'},
 {id:'D08',title:'ประกาศผู้ชนะ',code:'D08',hint:'เลือกไฟล์ e-GP หรือสร้างร่างจากข้อมูลกลางตามแหล่งที่เลือก'},
 {id:'D09',title:'ใบสั่งซื้อ / จ้าง และกำหนดสัญญา',code:'D09',hint:'ระบุเลขใบสั่ง วันที่ และวันครบสัญญา เชื่อมกำหนดเวลาไปยังปฏิทิน'},
 {id:'D10',title:'ข้อมูลสาระสำคัญจาก e-GP',code:'D10',hint:'เก็บไฟล์หรือภาพต้นทาง e-GP แบบร่างไม่แทนหลักฐานต้นทาง'},
 {id:'E01',title:'ข้อมูลสัญญา e-GP ที่แสดงใน e-LAAS',code:'E01',hint:'แนบไฟล์หรือภาพหน้าจอจาก e-LAAS และตรวจข้อมูลอ้างอิง'},
 {id:'D11',title:'ใบตรวจรับพัสดุ / งานจ้าง',code:'D11',hint:'บันทึกผลตรวจรับ วันที่จริง และค่าปรับก่อนยืนยันใบตรวจรับ'},
 {id:'D12',title:'รายงานผลตรวจรับ',code:'D12',hint:'จัดทำรายงานจากผลตรวจรับที่บันทึกไว้และแนบฉบับลงนาม'},
 {id:'D13',title:'รายงานวิธีการและหลักฐาน',code:'D13',hint:'ตรวจวิธีดำเนินการและหลักฐานของเรื่องให้ครบ'},
 {id:'D14',title:'ขออนุมัติเบิกจ่าย',code:'D14',hint:'ตรวจยอดเบิกจากบิลและเอกสารตรวจรับ แล้วเสนอผู้มีอำนาจลงนาม'},
 {id:'debt',title:'ส่งตั้งหนี้และรับเอกสารกลับจากคลัง',hint:'บันทึกส่งรอบแรก คลังลงรับ และคลังส่งเอกสารกลับให้ทำฎีกาต่อ'},
 {id:'V01',title:'อัปโหลด PDF ฎีกาและสแกนลงนาม',code:'V01',hint:'แนบ PDF ฎีกาจาก e-LAAS แล้วแนบสแกนที่ผู้มีอำนาจลงนามครบ'},
 {id:'voucher',title:'ส่งฎีกาและคลังลงรับรอบสอง',hint:'ตรึงชุดฎีกา ส่งคลัง และบันทึกคลังลงรับรอบสองเพื่อจบงาน'},
] as const;
export type ProcurementJourneyId=typeof procurementJourney[number]['id'];
export type JourneyCheck={code:ProcurementDocumentCode;ready:boolean;reason:string;exempt:boolean};
export type JourneyProgress={stages:{id:ProcurementJourneyId;ready:boolean;exempt:boolean;reason:string;blockedBy:ProcurementJourneyId|null}[];current:ProcurementJourneyId;done:number;total:number};
export function journeyProgress(data:ProcurementInput,checks:JourneyCheck[]):JourneyProgress{
 const state=data.workflow.state,firstFrozen=state!=='preparing'&&data.workflow.packets.some(p=>p.round===1),firstFinished=['returned_for_voucher','voucher_sent','closed'].includes(state),secondFrozen=['voucher_sent','closed'].includes(state)&&data.workflow.packets.some(p=>p.round===2);
 let firstPending:ProcurementJourneyId|null=null,done=0;
 const stages=procurementJourney.map(stage=>{
  let ready=false,exempt=false,reason='';
  if('code'in stage){
   const check=checks.find(c=>c.code===stage.code);ready=check?.ready||false;exempt=check?.exempt||false;reason=check?.reason||'ยังไม่ได้สร้างหรือเลือกเอกสาร';
   if(stage.code!=='V01'&&firstFrozen||stage.code==='V01'&&secondFrozen){ready=true;reason='';}
   else if(!exempt&&stage.code==='D09'&&ready&&!data.contractDue){ready=false;reason='ระบุวันครบกำหนดสัญญา';}
   else if(!exempt&&stage.code==='D11'&&ready&&(data.inspection.result!=='complete'||data.inspection.penalty==='pending')){ready=false;reason='บันทึกผลตรวจรับครบถ้วนและผลค่าปรับตามจริง';}
   if(stage.code==='V01'&&!firstFinished){ready=false;reason='รอคลังส่งเอกสารกลับเพื่อทำฎีกา';}
  }else if(stage.id==='debt'){ready=firstFinished;reason=ready?'':state==='preparing'?'ตรวจชุดขอเบิกจ่ายและส่งตั้งหนี้':state==='debt_sent'?'รอคลังลงรับรอบแรก':'รอเจ้าหน้าที่คลังแจ้งและส่งเอกสารกลับ';}
  else {ready=state==='closed';reason=ready?'':state==='voucher_sent'?'รอคลังลงรับรอบสอง':'ส่งชุดฎีกาที่ลงนามแล้วให้คลัง';}
  const blockedBy=firstPending;if(!ready&&!firstPending)firstPending=stage.id;
  if(ready&&!blockedBy)done++;
  return {id:stage.id,ready,exempt,reason:ready?'':reason,blockedBy};
 });
 return {stages,current:firstPending||'voucher',done,total:stages.length};
}
