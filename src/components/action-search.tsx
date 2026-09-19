'use client';
import {useEffect,useRef,useState} from 'react';
import {Search,ArrowUpRight,X} from 'lucide-react';
import {searchWorkActions,type WorkAction} from '@/lib/action-search';
import s from './action-search.module.css';
export function ActionSearch({onChoose}:{onChoose:(action:WorkAction)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [query,setQuery]=useState('');const results=searchWorkActions(query);
 function open(){if(!dialog.current?.open){setQuery('');dialog.current?.showModal();input.current?.focus();}}
 function close(){dialog.current?.close();trigger.current?.focus();}
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[]);
 function choose(action:WorkAction){close();onChoose(action);}
 return <><button ref={trigger} type="button" className={s.trigger} onClick={open}><Search size={18}/><span>อยากทำอะไร?</span><kbd>Ctrl K</kbd></button>
 <dialog ref={dialog} className={s.dialog} aria-labelledby="action-search-title" onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
 <div className={s.header}><div><h2 id="action-search-title">อยากทำอะไร?</h2><p>บอกงานที่ต้องการ แล้วเลือกทางลัดที่เหมาะกับคุณ</p></div><button type="button" onClick={close} aria-label="ปิดค้นหางาน"><X size={20}/></button></div>
 <div className={s.input}><Search size={21}/><input ref={input} aria-label="ค้นหาเมนูด้วยสิ่งที่ต้องการทำ" placeholder="เช่น โอนงบซื้อคอม หรือนัดประชุม" value={query} maxLength={250} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'){e.preventDefault();dialog.current?.querySelector<HTMLButtonElement>('[data-result]')?.focus();}if(e.key==='Enter'&&results[0]){e.preventDefault();choose(results[0].action);}}}/></div>
 {!query&&<div className={s.examples}>{['โอนงบซื้อคอม','นัดประชุม','กู้คืนข้อมูล'].map(text=><button type="button" key={text} onClick={()=>{setQuery(text);input.current?.focus();}}>{text}</button>)}</div>}
 <p className={s.count} aria-live="polite">{query?`พบ ${results.length} ทางลัดที่เกี่ยวข้อง`:'งานที่ใช้บ่อย'}</p>
 <div className={s.results}>{results.map(({action,matched},i)=><button type="button" data-result key={action.id} className={s.result} onClick={()=>choose(action)} onKeyDown={e=>{if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;e.preventDefault();const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('[data-result]');if(e.key==='ArrowUp'&&i===0)input.current?.focus();else buttons?.[Math.max(0,Math.min(results.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();}}><span><strong>{action.title}</strong><small>{action.description}</small>{query&&matched.length>0&&<em>เกี่ยวข้องกับ: {matched.slice(0,2).join(' · ')}</em>}</span><ArrowUpRight size={18}/></button>)}</div>
 {query&&!results.length&&<div className={s.empty}>ยังไม่พบงานที่ตรง ลองใช้คำว่า “หนังสือ” “ประชุม” “งบประมาณ” หรือ “กฎหมาย”<button type="button" onClick={()=>{setQuery('');input.current?.focus();}}>ดูทางลัดเริ่มต้น</button></div>}
 <footer className={s.footer}>ค้นจากคำและคำใกล้เคียงในระบบ · ไม่ส่งข้อความไปบริการ AI ภายนอก<br/>↑ ↓ เลือก · Enter เปิด · Esc ปิด</footer>
 </dialog></>;
}
