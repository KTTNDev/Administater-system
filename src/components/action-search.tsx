'use client';
import {useEffect,useRef,useState} from 'react';
import {Search,ArrowUpRight,X,FilePlus2,BookOpen,Wallet,DoorOpen,CalendarDays,FolderOpen,BriefcaseBusiness,ChartNoAxesCombined,Settings2,HelpCircle,Files,type LucideIcon} from 'lucide-react';
import {searchWorkActions,workActions,type WorkAction,type SearchDestination} from '@/lib/action-search';
import s from './action-search.module.css';

const icons:Record<SearchDestination,LucideIcon>={register:BookOpen,budget:Wallet,bookings:DoorOpen,calendar:CalendarDays,laws:BookOpen,dashboard:FolderOpen,office:BriefcaseBusiness,reports:ChartNoAxesCombined,settings:Settings2,templates:Files,guide:HelpCircle};
const quickStarts=['create-external','create-internal'].map(id=>workActions.find(action=>action.id===id)!);

export function ActionSearch({onChoose}:{onChoose:(action:WorkAction)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null);
 const [query,setQuery]=useState(''),[ready,setReady]=useState(false);
 const results=searchWorkActions(query),hasQuery=Boolean(query.trim());
 function open(){
  if(dialog.current?.open)return;
  // Keep a pending edit or confirmation dialog in charge of focus.
  if(Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[aria-modal="true"]')).some(element=>element!==dialog.current&&element.getClientRects().length))return;
  previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setQuery('');dialog.current?.showModal();input.current?.focus();
 }
 function close(){dialog.current?.close();}
 function restoreFocus(){const previous=previousFocus.current;previousFocus.current=null;(previous?.isConnected?previous:trigger.current)?.focus({preventScroll:true});}
 useEffect(()=>{
  setReady(true);
  const handle=(e:KeyboardEvent)=>{
   if(e.defaultPrevented||e.isComposing||e.altKey)return;
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.current?.open)close();else open();}
  };
  window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
 },[]);
 function choose(action:WorkAction){close();onChoose(action);}
 function clear(){setQuery('');input.current?.focus();}
 function focusResult(index:number){
  const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('[data-result]');
  if(index<0){input.current?.focus();return;}
  buttons?.[Math.min(index,results.length-1)]?.focus();
 }
 return <>
  <button ref={trigger} type="button" aria-label="อยากทำอะไร?" aria-haspopup="dialog" disabled={!ready} className={s.trigger} onClick={open}><Search size={18} aria-hidden="true"/><span>ค้นหาเมนูและทางลัด</span><kbd aria-hidden="true">Ctrl K</kbd></button>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="action-search-title" onClose={restoreFocus} onClick={e=>{
   if(e.target!==dialog.current)return;
   const r=dialog.current.getBoundingClientRect();
   if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();
  }}>
   <header className={s.header}><div><h2 id="action-search-title">อยากทำอะไร?</h2><p>พิมพ์ชื่องาน หรือเลือกทางลัด</p></div><button type="button" onClick={close} aria-label="ปิดค้นหางาน"><X size={20} aria-hidden="true"/></button></header>
   <div className={s.input}><Search size={20} aria-hidden="true"/><input ref={input} aria-label="ค้นหาเมนูด้วยสิ่งที่ต้องการทำ" placeholder="เช่น หนังสือ หรือประชุม" value={query} maxLength={250} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{
    if(e.nativeEvent.isComposing)return;
    if(e.key==='ArrowDown'){e.preventDefault();focusResult(0);}
    if(e.key==='ArrowUp'){e.preventDefault();focusResult(results.length-1);}
    if(e.key==='Enter'&&results[0]){e.preventDefault();choose(results[0].action);}
   }}/>{query&&<button type="button" aria-label="ล้างคำค้นเมนู" onClick={clear}><X size={17} aria-hidden="true"/></button>}</div>
   {!hasQuery&&<section className={s.quickStarts} aria-label="เริ่มร่างจากทางลัด">{quickStarts.map(action=><button type="button" key={action.id} onClick={()=>choose(action)}><FilePlus2 size={18} aria-hidden="true"/><span>{action.documentType==='external'?'หนังสือภายนอก':'บันทึกข้อความ'}</span></button>)}</section>}
   <p className={s.count} role="status">{hasQuery?'พบ '+results.length+' ทางลัดที่เกี่ยวข้อง':'ไปยังงาน'}</p>
   <div className={s.results} aria-label="ผลค้นหาเมนู">{results.map(({action},i)=>{
    const Icon=action.documentType?FilePlus2:icons[action.view];
    return <button type="button" data-result key={action.id} className={s.result} onClick={()=>choose(action)} onKeyDown={e=>{
     if(e.nativeEvent.isComposing)return;
     if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focusResult(i+(e.key==='ArrowDown'?1:-1));}
     if(e.key==='Home'||e.key==='End'){e.preventDefault();focusResult(e.key==='Home'?0:results.length-1);}
    }}><span className={s.icon}><Icon size={20} aria-hidden="true"/></span><span className={s.resultCopy}><strong title={action.title}>{action.title}</strong><small>{action.description}</small></span><ArrowUpRight className={s.arrow} size={17} aria-hidden="true"/></button>;
   })}
   {hasQuery&&!results.length&&<div className={s.empty}><Search size={26} aria-hidden="true"/><strong>ยังไม่พบงานที่ตรง</strong><p>ลองค้น “หนังสือ” “ประชุม” หรือ “กฎหมาย”</p><button type="button" onClick={clear}>ดูทางลัดเริ่มต้น</button></div>}
   </div>
   <footer className={s.footer}><span>ค้นหาเฉพาะเมนูในเครื่อง</span><span><kbd>↑ ↓</kbd> เลือก <kbd>Enter</kbd> เปิด <kbd>Esc</kbd> ปิด</span></footer>
  </dialog>
 </>;
}
