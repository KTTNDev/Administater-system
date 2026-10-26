import type {Draft} from './document';
export const minutesPresets=[
 {id:'general',name:'ประชุมทั่วไป',description:'วาระมาตรฐาน 5 เรื่อง ปรับชื่อและมติได้'},
 {id:'tor-purchase',name:'ประชุม TOR / คุณลักษณะเฉพาะพัสดุ',description:'คำสั่งแต่งตั้ง รายชื่อกรรมการ คุณลักษณะ เงื่อนไขส่งมอบและรับประกัน'},
 {id:'tor-service',name:'ประชุม TOR / ขอบเขตงานจ้าง',description:'ที่มา วัตถุประสงค์ ขอบเขตงาน ผลงานส่งมอบ และเงื่อนไขสัญญา'},
] as const;
export type MinutesPresetId=typeof minutesPresets[number]['id'];
const purchaseSections=['ความเป็นมา','วัตถุประสงค์','รายละเอียดคุณลักษณะเฉพาะของพัสดุ','เอกสารประกอบข้อเสนอและเงื่อนไขอื่น','กำหนดเวลาและสถานที่ส่งมอบ','การตรวจรับและเงื่อนไขการจ่ายเงิน','การรับประกันและบริการหลังการขาย','ค่าปรับและข้อกำหนดเพิ่มเติม'];
const serviceSections=['ความเป็นมา','วัตถุประสงค์','ขอบเขตงานและวิธีดำเนินงาน','คุณสมบัติและเอกสารประกอบข้อเสนอ','ผลงานที่ต้องส่งมอบและกำหนดเวลา','การตรวจรับและเงื่อนไขการจ่ายเงิน','การรับประกันผลงาน','ค่าปรับและข้อกำหนดเพิ่มเติม'];
export function minutesPresetPatch(draft:Draft,id:MinutesPresetId,mode:'append'|'replace'):Partial<Draft>{
 const tor=id!=='general',alreadyHasDetails=mode==='append'&&draft.meetingAgenda.some(a=>a.torDetails);
 const titles=['เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ','รับรองรายงานการประชุมครั้งที่ผ่านมา','เรื่องเพื่อทราบ',tor?'พิจารณาร่างขอบเขตของงาน (TOR) / รายละเอียดคุณลักษณะเฉพาะ':'เรื่องเสนอเพื่อพิจารณา','เรื่องอื่น ๆ'];
 const agenda:Draft['meetingAgenda']=titles.map((title,index)=>({title,discussion:'',resolution:'',resolutionLabel:'มติที่ประชุม',...(tor&&index===3&&!alreadyHasDetails?{torDetails:true}:{})}));
 const meetingAgenda=mode==='append'?[...draft.meetingAgenda,...agenda]:agenda;
 if(meetingAgenda.length>50)throw Error('เพิ่มแม่แบบแล้วเกิน 50 วาระ กรุณาลดวาระเดิมก่อน');
 return {minutesPreset:id,minutesMode:'agenda',meetingAgenda,
  ...(tor?{minutesTitle:draft.minutesTitle||'รายงานการประชุมคณะกรรมการจัดทำร่างขอบเขตของงาน (TOR)',minutesAttendanceMode:'table' as const,
   meetingMembers:draft.meetingMembers.length?draft.meetingMembers:[{name:'',position:'',role:'ประธานกรรมการ',status:'present',note:''},{name:'',position:'',role:'กรรมการ',status:'present',note:''},{name:'',position:'',role:'กรรมการและเลขานุการ',status:'present',note:''}],
   minutesTor:{...draft.minutesTor,sections:draft.minutesTor.sections.length?draft.minutesTor.sections:(id==='tor-purchase'?purchaseSections:serviceSections).map(title=>({title,body:''}))},
  }:{}),
 };
}
export function torDetailSections(d:Draft){return d.minutesTor.sections.map((s,i)=>({title:`${i+1}. ${s.title}`,text:s.body}));}
