'use client';
import type {CSSProperties} from 'react';
import {useState} from 'react';
import {defaultHeaderAppearance,headerAppearanceStyle,headerMenus,homeArt,homeTones,type HeaderAppearance,type HeaderTarget,type HomeLayout} from '@/lib/home-layout';
import {prepareHomeImage} from '@/app/home-layout-actions';
import {ImageFocusEditor} from './image-focus-editor';
import {defaultImageFocus} from '@/lib/image-focus';

export function MenuHeaderSettings({headers,onChange,onBusy,onError,onMessage}:{headers:HomeLayout['headers'];onChange:(value:HomeLayout['headers'])=>void;onBusy:(busy:boolean)=>void;onError:(message:string)=>void;onMessage:(message:string)=>void}){
 const [selected,setSelected]=useState<HeaderTarget>('tasks');
 const value=headers[selected]||defaultHeaderAppearance(selected);
 const src=value.background==='image'?value.image:value.background==='illustration'?homeArt[value.art]:'';
 function patch(input:Partial<HeaderAppearance>){onChange({...headers,[selected]:{...value,...input}});onError('');onMessage('');}
 async function upload(file:File|undefined){
  if(!file)return;onBusy(true);onError('');onMessage('');try{const form=new FormData();form.set('file',file);const result=await prepareHomeImage(form);if(!result.ok)throw Error(result.error);patch({image:result.image,background:'image',focus:defaultImageFocus()});onMessage('เตรียมรูปส่วนหัวแล้ว ตรวจตัวอย่างและกดบันทึกหน้าหลักเพื่อใช้จริง');}catch(e){onError(e instanceof Error?e.message:'เตรียมรูปไม่สำเร็จ');}finally{onBusy(false);}
 }
 return <details className="home-display-options menu-header-settings" aria-label="พื้นหลังส่วนหัวแต่ละเมนู"><summary>พื้นหลังส่วนหัวแต่ละเมนู</summary>
  <div className="home-settings-grid">
   <label>เมนูที่จะปรับส่วนหัว<select aria-label="เมนูที่จะปรับส่วนหัว" value={selected} onChange={e=>setSelected(e.target.value as HeaderTarget)}>{Object.entries(headerMenus).map(([key,menu])=><option key={key} value={key}>{menu.label}</option>)}</select></label>
   <label>พื้นหลังส่วนหัวเมนู<select aria-label="พื้นหลังส่วนหัวเมนู" value={value.background} onChange={e=>patch({background:e.target.value as HeaderAppearance['background']})}><option value="default">ใช้รูปแบบเดิมของเมนู</option><option value="solid">สีพื้น</option><option value="illustration">ภาพประกอบของระบบ</option><option value="image">รูปของฉัน</option></select></label>
   <label>สีส่วนหัวเมนู<select aria-label="สีส่วนหัวเมนู" disabled={value.background==='default'} value={value.tone} onChange={e=>patch({tone:e.target.value as HeaderAppearance['tone']})}><option value="default">สีประจำหมวดเดิม</option>{Object.entries(homeTones).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   {value.background==='illustration'&&<label>ภาพประกอบส่วนหัว<select aria-label="ภาพประกอบส่วนหัว" value={value.art} onChange={e=>patch({art:e.target.value as HeaderAppearance['art']})}>{Object.keys(homeArt).map((key,i)=><option key={key} value={key}>{['เอกสาร','รายการงาน','แผนโครงการ','พัสดุ','รายงาน','พื้นที่จัดเก็บ'][i]}</option>)}</select></label>}
   {value.background==='image'&&<div className="home-photo-control"><label>รูปส่วนหัวเมนู<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>{value.image&&<button type="button" onClick={()=>patch({image:'',background:'solid'})}>ลบรูปส่วนหัวเมนู</button>}</div>}
   {!!src&&<label>ความเข้มภาพส่วนหัว {Math.round(value.opacity*100)}%<input aria-label="ความเข้มภาพส่วนหัว" type="range" min="0" max="60" step="5" value={Math.round(value.opacity*100)} onChange={e=>patch({opacity:Number(e.target.value)/100})}/></label>}
  </div>
  <div className="header-style-preview" data-header-custom={value.background!=='default'} data-workspace-category={headerMenus[selected].category} style={{...headerAppearanceStyle(value),'--section-art':`url("${homeArt[headerMenus[selected].art]}")`} as CSSProperties}><div className="function-banner"><h2>{headerMenus[selected].label}</h2><p>ตัวอย่างส่วนหัวเมนู · ข้อความยังคงอ่านชัดบนพื้นหลัง</p></div></div>
  {!!src&&<ImageFocusEditor key={selected+'-'+value.background} src={src} value={value.focus} onChange={focus=>patch({focus})} label="ตำแหน่งภาพส่วนหัวเมนู" fit={value.background==='illustration'?'art':'cover'} opacity={value.opacity}/>}
  <div className="menu-header-footer"><button type="button" onClick={()=>{const next={...headers};delete next[selected];onChange(next);onError('');onMessage('คืนส่วนหัวเมนูนี้เป็นรูปแบบเดิมในตัวอย่างแล้ว กดบันทึกเพื่อใช้จริง');}}>คืนค่าเฉพาะเมนูนี้</button><small>กด “บันทึกหน้าหลัก” ด้านล่างเพื่อบันทึกทั้งหมด · ส่วนหัวหน้า Home ปรับใน “ส่วนหัวและองค์ประกอบหน้าหลัก”</small></div>
 </details>;
}
