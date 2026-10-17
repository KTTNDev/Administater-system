'use client';
import {useState} from 'react';
import {Files,ArrowRight,BookOpen} from 'lucide-react';
import {groups,templates,type DocumentType} from '@/lib/templates';
import {WorkspaceHeading,DetailNote} from './workspace-ui';
import {TemplateReference} from './template-reference';

function Paper({type}:{type:DocumentType}){
 const memo=type==='internal';
 return <svg viewBox="0 0 100 132" className="template-miniature" aria-hidden="true"><rect x="1" y="1" width="98" height="130" rx="3" className="paper-sheet"/>{templates.find(item=>item.id===type)?.mark&&<image href="/assets/garuda.png" x={memo?12:42} y="12" width={memo?13:16} height={memo?17:21}/>}{memo&&<rect x="33" y="17" width="49" height="4" rx="2" className="paper-title"/>}<g className="paper-lines"><path d={memo?'M12 37H86 M12 45H86 M12 53H60':'M12 42H33 M63 42H87 M46 51H70 M12 61H72'}/><path d="M22 72H86 M12 80H86 M12 88H86 M12 96H61 M54 113H81"/></g>{type==='minutes'&&<path d="M12 66V103H86V66 M12 85H86 M45 66V103" className="paper-lines"/>}</svg>;
}

export function TemplateGallery({onCreate}:{onCreate:(type:DocumentType)=>void}){
 const [category,setCategory]=useState('all');
 return <main className="page-main templates-main workspace-page">
  <WorkspaceHeading icon={Files} title="เลือกแบบหนังสือราชการ" description="เลือกจากลักษณะงาน แล้วเริ่มร่างได้เลย"/>
  <nav className="template-categories" aria-label="หมวดแบบหนังสือ"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>ทั้งหมด <span>{templates.length}</span></button>{groups.map(group=><button key={group} aria-pressed={category===group} onClick={()=>setCategory(group)}>{group}</button>)}</nav>
  <div className="template-library">
   {templates.some(item=>['external','internal'].includes(item.id)&&(category==='all'||item.group===category))&&<section className="template-featured" aria-label="แบบหนังสือใช้บ่อย">
    <h2>ใช้บ่อย</h2><div className="template-featured-grid">{templates.filter(item=>['external','internal'].includes(item.id)&&(category==='all'||item.group===category)).map(item=><button className="template-card template-choice template-feature" key={item.id} onClick={()=>onCreate(item.id)}><span className="template-visual"><Paper type={item.id}/></span><span className="template-choice-copy"><h3>{item.name}</h3><p>{item.description}</p><span className="template-start">เริ่มร่าง <ArrowRight size={16} aria-hidden="true"/></span></span></button>)}</div>
   </section>}
   {groups.map(group=>{const items=templates.filter(item=>item.group===group&&!['external','internal'].includes(item.id)&&(category==='all'||category===group));return items.length>0&&<section className="template-family" key={group}><h2>{group}</h2><div className="template-register">{items.map(item=><button className="template-card template-choice template-row" key={item.id} onClick={()=>onCreate(item.id)}><span className="template-visual"><Paper type={item.id}/></span><span className="template-choice-copy"><h3>{item.name}</h3><p>{item.description}</p></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div></section>})}
  </div>
  <DetailNote title="ที่มาของแบบหนังสือและคู่มือเพิ่มเติม"><p><BookOpen size={17}/> ภายนอก ภายใน และประทับตราอ้างอิงไฟล์ สถ. แบบอื่นใช้โครงสร้างตามระเบียบและต้องตรวจรับรูปแบบเฉพาะหน่วยงาน</p><TemplateReference/></DetailNote>
 </main>;
}
