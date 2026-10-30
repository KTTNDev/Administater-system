"use client";
import {useEffect,useState} from "react";
import {ArrowRight,BookOpen,FileText,Pause,Play} from "lucide-react";

const capabilities=["ร่างบันทึกข้อความ","ร่างรายงานการประชุม","สร้างแฟ้มข้อมูลอิเล็กทรอนิกส์"];
// Only the welcome page animates. Thai combining marks stay with their base character.
export function HomeHero({onEnter,onTemplates}:{onEnter?:()=>void;onTemplates?:()=>void}) {
 const [paused,setPaused]=useState(false),[reduced,setReduced]=useState(true),[hidden,setHidden]=useState(false),[engaged,setEngaged]=useState(false);
 const [typing,setTyping]=useState({word:0,length:0,deleting:false});
 useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)");const sync=()=>setReduced(media.matches);const visibility=()=>setHidden(document.hidden);sync();visibility();media.addEventListener("change",sync);document.addEventListener("visibilitychange",visibility);return()=>{media.removeEventListener("change",sync);document.removeEventListener("visibilitychange",visibility)}},[]);
 const chars=Array.from(new Intl.Segmenter("th",{granularity:"grapheme"}).segment(capabilities[typing.word]),x=>x.segment);
 useEffect(()=>{
  if(paused||reduced||hidden||engaged)return;
  const full=typing.length===chars.length;
  const timer=setTimeout(()=>setTyping(t=>t.deleting?(t.length===0?{word:(t.word+1)%capabilities.length,length:0,deleting:false}:{...t,length:t.length-1}):full?{...t,deleting:true}:{...t,length:t.length+1}),full&&!typing.deleting?2400:typing.deleting?55:110);
  return()=>clearTimeout(timer);
 },[typing,chars.length,paused,reduced,hidden,engaged]);
 return <main className="welcome-page">
  <section className="welcome-hero" aria-labelledby="welcome-title">
   <div className="welcome-landscape" aria-hidden="true"/>
   <div className="welcome-copy">
    <p className="welcome-eyebrow">SARABUN / พื้นที่ทำงานเอกสาร</p>
    <h1 id="welcome-title">เริ่มงานวันนี้<br/>ให้เป็นระเบียบขึ้น</h1>
    <div className="welcome-typing" onMouseEnter={()=>setEngaged(true)} onMouseLeave={()=>setEngaged(false)} onFocus={()=>setEngaged(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setEngaged(false)}}>
     <span aria-hidden="true" data-testid="welcome-typed">{reduced?capabilities[0]:chars.slice(0,typing.length).join("")}<i className={paused||reduced||hidden||engaged?"still":""}/></span>
     <span className="welcome-sr">{capabilities.join(" · ")}</span>
     {!reduced&&<button type="button" onClick={()=>setPaused(!paused)} aria-label={paused?"เล่นข้อความเคลื่อนไหว":"หยุดข้อความเคลื่อนไหว"}>{paused?<Play size={14}/>:<Pause size={14}/>}</button>}
    </div>
    <p className="welcome-description">จากร่างฉบับแรกถึงเอกสารพร้อมใช้<br/>จัดทำ ตรวจทาน และเก็บงานไว้ในที่เดียว</p>
    <div className="welcome-actions">
     {onEnter?<button className="primary" onClick={onEnter}>เข้าสู่พื้นที่ทำงาน<ArrowRight size={18}/></button>:<a className="primary" href="/">เข้าสู่พื้นที่ทำงาน<ArrowRight size={18}/></a>}
     {onTemplates?<button className="welcome-secondary" onClick={onTemplates}>เลือกแบบหนังสือ<ArrowRight size={16}/></button>:<a className="welcome-secondary" href="/?view=templates">เลือกแบบหนังสือ<ArrowRight size={16}/></a>}
    </div>
   </div>
   <div className="welcome-caption"><span>พื้นที่สำหรับงานที่ต้องใส่ใจ</span><span>ร่าง · ตรวจทาน · จัดเก็บ</span></div>
  </section>
  <aside className="welcome-note" aria-label="แนวทางเริ่มใช้งาน"><FileText size={22}/><div><h2>เริ่มจากแบบหนังสือที่คุณคุ้นเคย</h2><p>กรอกข้อมูลพร้อมดูหน้ากระดาษจริงด้านข้าง กลับมาแก้ไขร่างเดิมได้ทุกเมื่อ</p></div><BookOpen size={22} aria-hidden="true"/></aside>
 </main>;
}
