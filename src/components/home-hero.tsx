"use client";
import {ArrowRight,FileText,FolderOpen,ListTodo} from "lucide-react";
import {CapabilityTypewriter} from "./capability-typewriter";

export function HomeHero({onEnter,onTemplates}:{onEnter?:()=>void;onTemplates?:()=>void}){
 return <main className="welcome-page">
  <section className="welcome-hero welcome-catalog" aria-labelledby="welcome-title">
   <div className="welcome-landscape" aria-hidden="true"/>
   <div className="welcome-copy">
    <h1 id="welcome-title">sarabun</h1>
    <CapabilityTypewriter/>
    <div className="welcome-actions">
     {onEnter?<button className="primary" onClick={onEnter}>เข้าสู่พื้นที่ทำงาน<ArrowRight size={18}/></button>:<a className="primary" href="/home">เข้าสู่พื้นที่ทำงาน<ArrowRight size={18}/></a>}
     {onTemplates?<button className="welcome-secondary" onClick={onTemplates}>เลือกแบบหนังสือ<ArrowRight size={16}/></button>:<a className="welcome-secondary" href="/?view=templates">เลือกแบบหนังสือ<ArrowRight size={16}/></a>}
    </div>
   </div>
  </section>
  <nav className="wd-launchers" aria-label="เลือกงานในระบบ">
   <a href="/?view=templates"><FileText size={25}/><span>หนังสือราชการ</span><ArrowRight size={18}/></a>
   <a href="/?view=tasks"><ListTodo size={25}/><span>งานของฉัน</span><ArrowRight size={18}/></a>
   <a href="/?view=projects"><FolderOpen size={25}/><span>โครงการประจำปี</span><ArrowRight size={18}/></a>
  </nav>
 </main>;
}
