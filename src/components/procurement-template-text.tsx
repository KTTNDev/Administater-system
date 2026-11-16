'use client';
import {useState} from 'react';
import {procurementBindings} from '@/lib/procurement';
import styles from './procurement-workspace.module.css';
export function ProcurementTemplateText({label,value,override,max,onChange,onReset,usage}:{label:string;value:string;override?:string;max:number;onChange:(value:string)=>void;onReset:()=>void;usage:string}){
 const [editing,setEditing]=useState(false),readable=value.replace(/\{\{([a-zA-Z]+)\}\}/g,(_,name)=>'['+(procurementBindings[name as keyof typeof procurementBindings]||name)+']');
 return <div className={styles.templateText}><div className={styles.templateTextHeading}><strong>{label}</strong><span>{override!==undefined?'ปรับเฉพาะฉบับ':'ข้อความตั้งต้น'}</span></div>
  {editing?<label><span className={styles.srOnly}>{label}</span><textarea aria-label={'แก้ '+label} rows={4} maxLength={max} value={override??readable} onChange={e=>onChange(e.target.value)}/></label>:<p>{readable||'[ยังไม่ระบุข้อความ]'}</p>}
  <small>{usage}</small><div className={styles.textActions}><button type="button" className="text-button" onClick={()=>setEditing(value=>!value)}>{editing?'ย่อช่องแก้ไข':'แก้ข้อความเฉพาะฉบับ'}</button>{override!==undefined&&<button type="button" className="text-button" onClick={()=>{onReset();setEditing(false);}}>กลับไปใช้ข้อความตั้งต้นที่ผูกข้อมูล</button>}</div>
 </div>;
}
