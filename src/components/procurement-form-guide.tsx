'use client';
import './document-form.css';
import {Building2,FileText,Paperclip,PenLine,Files,ShoppingCart,ChevronLeft,ChevronRight,CalendarClock,Landmark} from 'lucide-react';
import {procurementSteps,procurementReadiness,type ProcurementStep} from '@/lib/procurement-form-flow';
import type {ProcurementInput} from '@/lib/procurement';
import type {DraftDocumentCode} from '@/lib/procurement-documents';
const hints:Record<ProcurementStep,string>={details:'เริ่มจากบิล: ร้านค้า รายการ จำนวน และราคา ใช้ร่วมทั้งชุด',header:'กรอกเลขและวันที่ เฉพาะฉบับที่ต้องออกตอนนี้',body:'มีข้อความจากแม่แบบแล้ว แก้เฉพาะส่วนที่จำเป็น',signing:'รายชื่อร่วมของงานนี้ ตรวจครั้งเดียว ไม่ต้องกรอกซ้ำทุกฉบับ',documents:'สร้างหรือเลือกเอกสารตามขั้นที่ถึง ไม่ต้องทำฉบับท้ายล่วงหน้า',contract:'เติมข้อมูลใบสั่ง กำหนดส่ง และผลตรวจรับเมื่อมีข้อมูลจริง',evidence:'แนบใบเสนอราคา ไฟล์ระบบ ภาพ และสแกนลงนาม',finance:'ตรวจสิ่งที่ยังขาด แล้วบันทึกการรับส่งคลังสองรอบ'};
const icons=[ShoppingCart,Building2,FileText,PenLine,Files,CalendarClock,Paperclip,Landmark];
export function ProcurementFormGuide({data,code,mode,onMode,step,onStep}:{data:ProcurementInput;code:DraftDocumentCode;mode:'scroll'|'steps';onMode:(mode:'scroll'|'steps')=>void;step:ProcurementStep;onStep:(step:ProcurementStep)=>void}){
 const readiness=procurementReadiness(data,code),index=procurementSteps.findIndex(item=>item.id===step);
 return <div className="procurement-form-guide"><div className="form-intro"><div><h2>{index+1}. {procurementSteps[index].label}</h2><p>{hints[step]}</p></div></div>
 <div className="form-mode-control" role="group" aria-label="วิธีกรอกแบบฟอร์ม"><span>วิธีกรอก</span><button type="button" aria-pressed={mode==='scroll'} onClick={()=>onMode('scroll')}>แสดงทุกส่วน</button><button type="button" aria-pressed={mode==='steps'} onClick={()=>onMode('steps')}>กรอกทีละส่วน</button></div>
 <section className="document-completion" aria-label="ความพร้อมของข้อมูล"><div><strong>{code==='D01'||code==='D07'?'ความพร้อม':'ข้อมูลบิล'} {readiness.percent}%</strong><span>{readiness.done}/{readiness.total} ช่องสำคัญ</span></div><progress aria-label="ความพร้อมข้อมูลของฉบับที่เลือก" max={100} value={readiness.percent}/><small>ข้อมูลของ {code} · ตรวจทานเอกสารก่อนใช้ ไม่ใช่การอนุมัติ</small></section>
 <div className="procurement-guide-nav"><nav className="form-jump-nav" aria-label="ไปยังส่วนของแบบฟอร์มจัดซื้อจัดจ้าง">{procurementSteps.map((item,i)=>{const Icon=icons[i];return <button key={item.id} type="button" aria-current={step===item.id?'step':undefined} className={step===item.id?'is-selected':undefined} onClick={()=>onStep(item.id)}><Icon size={16}/><span>{item.label}</span></button>;})}</nav>
 {mode==='steps'&&<div className="form-step-controls"><button type="button" disabled={index===0} onClick={()=>onStep(procurementSteps[index-1].id)}><ChevronLeft size={16}/>ย้อนกลับ</button><span role="status">ส่วนที่ {index+1}/{procurementSteps.length} · {procurementSteps[index].label}</span><button type="button" disabled={index===procurementSteps.length-1} onClick={()=>onStep(procurementSteps[index+1].id)}>ถัดไป<ChevronRight size={16}/></button></div>}</div></div>;
}
