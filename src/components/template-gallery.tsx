'use client';
import {useState} from 'react';
import {Files,ArrowUpRight,BookOpen} from 'lucide-react';
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
  <WorkspaceHeading icon={Files} title="เลือกแบบหนังสือราชการ" description="เลือกแบบที่ต้องการ แล้วเริ่มกรอกพร้อมดูตัวอย่างได้เลย"/>
  <nav className="template-categories" aria-label="หมวดแบบหนังสือ"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>ทั้งหมด <span>{templates.length}</span></button>{groups.map(group=><button key={group} aria-pressed={category===group} onClick={()=>setCategory(group)}>{group}</button>)}</nav>
  <div className="template-catalogue">{templates.filter(item=>category==='all'||item.group===category).map(item=><button className={`template-card template-choice ${['external','internal'].includes(item.id)?'template-frequent':''}`} key={item.id} onClick={()=>onCreate(item.id)}><span className="template-visual"><Paper type={item.id}/></span><span className="template-choice-copy"><small>{item.group}</small><h3>{item.name}</h3><p>{item.description}</p><span className="template-source">{item.source==='DLA'?'อ้างอิงแผ่นแบบ สถ.':item.source==='CUSTOM'?'ปรับตามลักษณะงาน':'ตามหมวดระเบียบ'}</span></span><ArrowUpRight size={18} className="template-choice-arrow" aria-hidden="true"/></button>)}</div>
  <DetailNote title="ที่มาของแบบหนังสือและคู่มือเพิ่มเติม"><p><BookOpen size={17}/> ภายนอก ภายใน และประทับตราอ้างอิงไฟล์ สถ. แบบอื่นใช้โครงสร้างตามระเบียบและต้องตรวจรับรูปแบบเฉพาะหน่วยงาน</p><TemplateReference/></DetailNote>
 </main>;
}
