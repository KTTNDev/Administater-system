'use client';
import {ArrowDown,ArrowUp,Plus,Trash2} from 'lucide-react';
import type {Draft} from '@/lib/document';
import {BodyEditor} from './body-editor';

type Pages=Draft['appendixPages'];
export function AppendixPagesEditor({pages,onChange}:{pages:Pages;onChange:(pages:Pages)=>void}){
 const update=(id:string,patch:Partial<Pages[number]>)=>onChange(pages.map(page=>page.id===id?{...page,...patch}:page));
 const move=(index:number,direction:-1|1)=>{const next=[...pages];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next)};
 const add=()=>{if(pages.length>=20)return;const id=crypto.randomUUID();onChange([...pages,{id,title:'',body:''}]);requestAnimationFrame(()=>document.getElementById(`appendix-title-${id}`)?.focus())};
 return <details className="form-section" open={pages.length>0}><summary><span className="step-number">＋</span><strong>เอกสารแนบท้ายที่สร้างในระบบ</strong><span>{pages.length} ฉบับ</span></summary><div className="field-grid">
  <p className="field-note wide">แต่ละฉบับเริ่มหน้าใหม่ · เพิ่มได้สูงสุด 20 ฉบับ</p>
  <button type="button" className="secondary wide" disabled={pages.length>=20} onClick={add}><Plus size={16}/> เพิ่มเอกสารแนบท้ายอีกฉบับ</button>
  {pages.map((page,index)=><section className="repeat-card wide" key={page.id} aria-label={`เอกสารแนบท้ายฉบับที่ ${index+1}`}>
   <div className="stamp-buttons"><strong>เอกสารแนบท้ายฉบับที่ {index+1}</strong><button type="button" aria-label={`เลื่อนเอกสารแนบท้ายฉบับที่ ${index+1} ขึ้น`} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={`เลื่อนเอกสารแนบท้ายฉบับที่ ${index+1} ลง`} disabled={index===pages.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" aria-label={`ลบเอกสารแนบท้ายฉบับที่ ${index+1}`} onClick={()=>{if((page.title||page.body)&&!confirm('ลบเอกสารแนบท้ายฉบับนี้และเนื้อหาทั้งหมดหรือไม่?'))return;onChange(pages.filter(item=>item.id!==page.id))}}><Trash2 size={16}/> ลบฉบับ</button></div>
   <label htmlFor={`appendix-title-${page.id}`}>หัวเรื่องเอกสารแนบท้ายฉบับที่ {index+1}</label><input id={`appendix-title-${page.id}`} value={page.title} maxLength={200} placeholder="เช่น รายละเอียดประกอบการพิจารณา" onChange={event=>update(page.id,{title:event.target.value})}/>
   <label htmlFor={`appendix-body-${page.id}`}>เนื้อหาเอกสารแนบท้ายฉบับที่ {index+1}</label><BodyEditor id={`appendix-body-${page.id}`} value={page.body} onChange={value=>update(page.id,{body:value})}/>
  </section>)}
 </div></details>;
}
