'use client';
import {useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import {Building2,BookOpen,Cloud,Database,LayoutDashboard,ListChecks,ContactRound} from 'lucide-react';

export type SettingsSection={id:string;label:string;description?:string;content:ReactNode;dirty?:boolean;busy?:boolean};
const icons:Record<string,typeof Building2>={appearance:LayoutDashboard,organization:Building2,directory:ContactRound,dictionary:BookOpen,drive:Cloud,storage:Database,readiness:ListChecks};

// Hide visited panels instead of unmounting them: pending input and async work
// belong to their original form, even while the user visits another category.
export function SettingsSections({id,label,sections,compact=false}:{id:string;label:string;sections:SettingsSection[];compact?:boolean}){
 const [active,setActive]=useState(sections[0].id);
 const [visited,setVisited]=useState(()=>new Set([sections[0].id]));
 const root=useRef<HTMLDivElement>(null);
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 function select(next:string){setVisited(previous=>new Set([...previous,next]));setActive(next);if(!compact&&root.current&&root.current.getBoundingClientRect().top<0)root.current.scrollIntoView({block:'start',behavior:'instant'});}
 function keyboard(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const previous=compact?'ArrowLeft':'ArrowUp',next=compact?'ArrowRight':'ArrowDown';
  let target:number;
  if(event.key===next)target=(index+1)%sections.length;
  else if(event.key===previous)target=(index+sections.length-1)%sections.length;
  else if(event.key==='Home')target=0;
  else if(event.key==='End')target=sections.length-1;
  else return;
  event.preventDefault();buttons.current[target]?.focus();
  // Manual activation avoids loading a remote settings panel just to move focus.
 }
 return <div ref={root} className="settings-sections" data-compact={compact}>
  <div className="settings-category-list" role="tablist" aria-label={label} aria-orientation={compact?'horizontal':'vertical'}>
   {sections.map((section,index)=>{const Icon=icons[section.id];return <button type="button" key={section.id} role="tab" aria-label={section.label} aria-describedby={section.busy||section.dirty?`${id}-status-${section.id}`:undefined} id={`${id}-tab-${section.id}`} aria-controls={`${id}-panel-${section.id}`} aria-selected={active===section.id} tabIndex={active===section.id?0:-1} ref={node=>{buttons.current[index]=node;}} onKeyDown={event=>keyboard(event,index)} onClick={()=>select(section.id)}>
    {Icon&&!compact&&<Icon size={18} aria-hidden="true"/>}<span><strong>{section.label}</strong>{section.description&&!compact&&<small>{section.description}</small>}</span>
    {section.busy?<span id={`${id}-status-${section.id}`} className="settings-category-dot" aria-label="กำลังประมวลผล" data-state="loading"/>:section.dirty?<span id={`${id}-status-${section.id}`} className="settings-category-dot" aria-label="มีข้อมูลยังไม่บันทึก"/>:null}
   </button>;})}
  </div>
  <div className="settings-category-content">
   {sections.map(section=><div key={section.id} role="tabpanel" id={`${id}-panel-${section.id}`} aria-labelledby={`${id}-tab-${section.id}`} hidden={active!==section.id} tabIndex={0} className="settings-category-panel">{visited.has(section.id)?section.content:null}</div>)}
  </div>
 </div>;
}
