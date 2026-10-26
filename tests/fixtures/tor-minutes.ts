import {newDraft,documentSchema} from '../../src/lib/document';
import {minutesPresetPatch} from '../../src/lib/minutes-presets';
export function torMeetingFixture(long=false){
 const base=newDraft('minutes');
 const d=documentSchema.parse({...base,...minutesPresetPatch(base,'tor-purchase','append'),subject:'ตัวอย่างประชุมกำหนด TOR โครงการจัดซื้อกล้องบันทึกภาพ',organization:'เทศบาลตัวอย่าง',meetingNo:'1/2569',date:'2026-10-26',location:'ห้องประชุมหน่วยงานตัวอย่าง',startTime:'09:00',endTime:'12:00',recorder:'เลขานุการตัวอย่าง',recorderPosition:'เจ้าพนักงานธุรการ',recorderRole:'กรรมการและผู้จดรายงานการประชุม'});
 d.minutesIntroduction='ตัวอย่างสำหรับตรวจรูปแบบเท่านั้น ไม่ใช่บันทึกการประชุมจริง';
 d.meetingMembers=Array.from({length:long?40:3},(_,i)=>({name:`กรรมการตัวอย่าง ${i+1}`,position:'ตำแหน่งตัวอย่าง',role:i===0?'ประธานกรรมการ':'กรรมการ',status:'present' as const,note:i===0?'ตัวอย่าง':''}));
 d.minutesTor={...d.minutesTor,appointmentNumber:'ตัวอย่าง/2569',appointmentDate:'2026-10-20',authority:'หน่วยงานตัวอย่าง',budget:'ระบุตามเอกสารงบประมาณ (ตัวอย่าง)',priceReference:'ระบุมาตรฐานและแหล่งอ้างอิงตามงานจริง',sections:d.minutesTor.sections.map((s,i)=>({...s,body:(`ตัวอย่างรายละเอียดหัวข้อ ${i+1} สำหรับตรวจการจัดหน้า เนื้อหาและเงื่อนไขต้องกรอกให้ตรงกับโครงการและหลักฐานที่ใช้พิจารณา `).repeat(long?16:2)+` จบหัวข้อ TOR ${i+1}`}))};
 d.meetingAgenda=d.meetingAgenda.map((a,i)=>({...a,discussion:`บันทึกข้ออภิปรายของวาระ ${i+1} ตามการประชุมจริง`,resolution:i===3?'ให้ทบทวนรายละเอียดและนำเสนอครั้งต่อไป (ตัวอย่าง)':''}));
 d.meetingAgenda[3].speeches=[{speaker:'กรรมการผู้ซักถาม',role:'กรรมการ',text:'ข้อซักถามตัวอย่างเรื่องการตรวจรับและเงื่อนไขการรับประกัน'},{speaker:'ผู้ชี้แจงตัวอย่าง',role:'กรรมการ',text:'คำชี้แจงตัวอย่าง ให้ระบุข้อมูลอ้างอิงก่อนสรุปผล'}];
 d.meetingSigners=[{name:'กรรมการตัวอย่าง 2',position:'ตำแหน่งตัวอย่าง',role:'กรรมการ'},{name:'กรรมการตัวอย่าง 1',position:'ตำแหน่งตัวอย่าง',role:'ประธานกรรมการ'}];
 return d;
}
