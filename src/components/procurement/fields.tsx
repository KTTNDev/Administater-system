import type {ReactNode} from 'react';
import type {StoredCase,WorkspaceMaster} from '@/lib/procurement/workspace/model';
import {THAI_PUBLIC_HOLIDAYS,isWorkingDay} from '@/lib/procurement/holidays';
import {calculateDraftAmounts} from '@/lib/procurement/calculations';
export type EditorProps={record:StoredCase;master:WorkspaceMaster;update:(change:(next:StoredCase)=>void)=>void};
export function Field({path,label,value,onChange,type='text',example,step,children}:{path:string;label:string;value:string|number;onChange:(value:string)=>void;type?:string;example?:string;step?:string;children?:ReactNode}){
  return <label className="pw-field" htmlFor={'pw-'+path}><span>{label}</span><input id={'pw-'+path} name={path} aria-label={label} type={type} value={value} min={type==='number'?0:undefined} step={step??(type==='number'?'any':undefined)} placeholder={example?'ตัวอย่าง: '+example:undefined} onChange={e=>onChange(e.target.value)}/>{children}{type==='date'&&value&&<DateBadge value={String(value)}/>}</label>;
}
export function DateBadge({value}:{value:string}){let working=true;try{working=isWorkingDay(value);}catch{return <small className="pw-warning">โปรดตรวจปฏิทินวันหยุดของปีนี้</small>;}return <small className={working?'pw-muted':'pw-warning'}>{new Date(value+'T12:00:00Z').toLocaleDateString('th-TH-u-nu-thai',{weekday:'short',day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'})} {working?'✓':`⚠ ${THAI_PUBLIC_HOLIDAYS[value]||'วันหยุดสุดสัปดาห์'}`}</small>;}
export const money=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat('th-TH-u-nu-thai',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n):'—';
export function formAmounts(items:Parameters<typeof calculateDraftAmounts>[0],vat:boolean){try{return {...calculateDraftAmounts(items,vat),error:''};}catch{return {grandTotal:NaN,subtotalExclVat:NaN,vatAmount:NaN,lineTotals:items.map(()=>NaN),error:'กรุณาตรวจจำนวนและราคา ต้องไม่ติดลบและไม่เกินขอบเขตจำนวนเงิน'};}}
export function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="pw-check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>;}
