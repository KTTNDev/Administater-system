"use client";
import {ArrowDown,ArrowUp,Plus,Trash2} from 'lucide-react';
import type {Draft} from '@/lib/document';

type Speeches=NonNullable<Draft['meetingAgenda'][number]['speeches']>;
export function MinutesSpeechesEditor({speeches=[],agendaNumber,onChange}:{speeches?:Speeches;agendaNumber:number;onChange:(speeches:Speeches)=>void}){
 const edit=(index:number,patch:Partial<Speeches[number]>)=>onChange(speeches.map((speech,i)=>i===index?{...speech,...patch}:speech));
 const move=(index:number,offset:number)=>{const next=[...speeches],to=index+offset;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];onChange(next);};
 const add=()=>{if(speeches.length<50)onChange([...speeches,{speaker:'',role:'',text:''}]);};
 return <section className="minutes-speeches" aria-label={`ผู้พูดในวาระที่ ${agendaNumber}`}>
  <div className="section-title"><strong>ผู้พูดและข้อซักถาม · {speeches.length} รายการ</strong><button type="button" className="secondary" disabled={speeches.length>=50} onClick={add}><Plus size={16}/>เพิ่มผู้พูด / ข้อซักถาม</button></div>
  <p className="field-note">เพิ่มได้หลายคนในวาระเดียว เรียงตามลำดับการพูด หากคนเดิมพูดอีกครั้งให้เพิ่มรายการใหม่ได้</p>
  {speeches.map((speech,index)=><section className="agenda-card" key={index} aria-label={`ผู้พูดลำดับที่ ${index+1}`}>
   <div className="section-title"><strong>ผู้พูดลำดับที่ {index+1}</strong><div className="agenda-actions">
    <button type="button" className="secondary" aria-label={`เลื่อนผู้พูด ${index+1} ขึ้น`} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button>
    <button type="button" className="secondary" aria-label={`เลื่อนผู้พูด ${index+1} ลง`} disabled={index===speeches.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button>
    <button type="button" className="secondary" aria-label={`ลบผู้พูด ${index+1}`} onClick={()=>{if(!speech.speaker.trim()&&!speech.role.trim()&&!speech.text.trim()||confirm('ลบผู้พูดและข้อความรายการนี้?'))onChange(speeches.filter((_,i)=>i!==index));}}><Trash2 size={16}/></button>
   </div></div>
   <div className="minutes-fields"><label>ชื่อผู้พูด<input maxLength={300} value={speech.speaker} onChange={e=>edit(index,{speaker:e.target.value})}/></label><label>บทบาทผู้พูด<input maxLength={200} value={speech.role} onChange={e=>edit(index,{role:e.target.value})}/></label></div>
   <label htmlFor={`speech-${agendaNumber}-${index}`}>คำอภิปราย / ข้อซักถาม</label><textarea id={`speech-${agendaNumber}-${index}`} rows={3} maxLength={10000} value={speech.text} onChange={e=>edit(index,{text:e.target.value})}/>
  </section>)}
  {speeches.length>=50&&<p role="status" className="field-note">วาระนี้ครบ 50 รายการแล้ว</p>}
 </section>;
}
