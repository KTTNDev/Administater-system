"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Draft } from '@/lib/document';

const suggestions=['เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ','รับรองรายงานการประชุมครั้งที่ผ่านมา','เรื่องสืบเนื่อง','เรื่องเสนอเพื่อพิจารณา','เรื่องอื่น ๆ'];
export function MinutesEditor({draft,onChange}:{draft:Draft;onChange:(patch:Partial<Draft>)=>void}) {
  const edit=(index:number,patch:Partial<Draft['meetingAgenda'][number]>)=>onChange({meetingAgenda:draft.meetingAgenda.map((a,i)=>i===index?{...a,...patch}:a)});
  const move=(index:number,offset:number)=>{const items=[...draft.meetingAgenda];[items[index],items[index+offset]]=[items[index+offset],items[index]];onChange({meetingAgenda:items});};
  return <div className="wide minutes-editor">
    <label>รูปแบบเนื้อหารายงาน<select value={draft.minutesMode} onChange={e=>onChange({minutesMode:e.target.value as Draft['minutesMode']})}><option value="free">ข้อความอิสระ / ร่างเดิม</option><option value="agenda">แยกวาระ ข้ออภิปราย และมติ</option></select></label>
    <p className="field-note">สลับรูปแบบได้โดยเก็บข้อความทั้งสองแบบไว้ เอกสารจะแสดงเฉพาะแบบที่เลือก</p>
    {draft.minutesMode==='agenda'&&<>
      <label>ข้อความเปิดประชุม<textarea rows={3} maxLength={10000} value={draft.minutesIntroduction} onChange={e=>onChange({minutesIntroduction:e.target.value})} placeholder="เช่น เมื่อผู้มาประชุมครบองค์ประชุม ประธานกล่าวเปิดประชุม…"/></label>
      <datalist id="meeting-agenda-suggestions">{suggestions.map(s=><option key={s} value={s}/>)}</datalist>
      <p className="field-note">หัวข้อแนะนำปรับได้ตามการประชุมจริง คู่มือไม่ได้กำหนดให้ทุกการประชุมต้องมีวาระเหมือนกัน</p>
      {draft.meetingAgenda.map((agenda,index)=><section className="agenda-card" key={index} aria-label={`วาระที่ ${index+1}`}>
        <div className="section-title"><strong>วาระที่ {index+1}</strong><div className="agenda-actions">
          <button type="button" className="secondary" aria-label={`เลื่อนวาระ ${index+1} ขึ้น`} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button>
          <button type="button" className="secondary" aria-label={`เลื่อนวาระ ${index+1} ลง`} disabled={index===draft.meetingAgenda.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button>
          <button type="button" className="secondary" aria-label={`ลบวาระ ${index+1}`} onClick={()=>{if(confirm(`ลบวาระที่ ${index+1} และข้อความในวาระนี้หรือไม่?`))onChange({meetingAgenda:draft.meetingAgenda.filter((_,i)=>i!==index)});}}><Trash2 size={16}/></button>
        </div></div>
        <label>หัวข้อวาระ<input list="meeting-agenda-suggestions" maxLength={300} value={agenda.title} onChange={e=>edit(index,{title:e.target.value})}/></label>
        <label>ข้ออภิปราย / รายละเอียด<textarea rows={5} maxLength={10000} value={agenda.discussion} onChange={e=>edit(index,{discussion:e.target.value})} placeholder="ระบุผู้เสนอ ประเด็น และความคิดเห็นที่ต้องบันทึก"/></label>
        <label>ชื่อหัวข้อผลการพิจารณา<select value={agenda.resolutionLabel} onChange={e=>edit(index,{resolutionLabel:e.target.value as typeof agenda.resolutionLabel})}>{['มติที่ประชุม','ข้อยุติ','ข้อสรุป'].map(s=><option key={s}>{s}</option>)}</select></label>
        <label>ผลการพิจารณา (ถ้ามี)<textarea rows={3} maxLength={5000} value={agenda.resolution} onChange={e=>edit(index,{resolution:e.target.value})} placeholder="ไม่กรอก ระบบจะไม่แสดงหัวข้อนี้ในเอกสาร"/></label>
      </section>)}
      <button type="button" className="secondary" disabled={draft.meetingAgenda.length>=50} onClick={()=>onChange({meetingAgenda:[...draft.meetingAgenda,{title:'',discussion:'',resolution:'',resolutionLabel:'มติที่ประชุม'}]})}><Plus size={16}/>เพิ่มวาระการประชุม</button>
    </>}
  </div>;
}
