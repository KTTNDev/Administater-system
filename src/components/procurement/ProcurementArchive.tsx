'use client';
import {useEffect,useState} from 'react';
import type {readProcurementArchive} from '@/lib/procurement/core/archive';
import {billValues} from '@/lib/procurement-bill';
type Archive=ReturnType<typeof readProcurementArchive>;
export function ProcurementArchive({caseId,onBack}:{caseId:string;onBack:()=>void}){
  const [data,setData]=useState<Archive|null>(null),[selected,setSelected]=useState(caseId==='*'?'':caseId),[error,setError]=useState('');
  useEffect(()=>{let active=true;fetch('/api/procurement/archive',{cache:'no-store'}).then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error);if(active)setData(value);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[]);
  const record=data?.cases.find(row=>row.id===selected);
  return <section className="pw-workspace" aria-label="คลังเอกสารจัดซื้อจัดจ้าง"><header className="pw-command"><button onClick={onBack}>กลับงานจัดซื้อจัดจ้าง</button><h1>เอกสารที่จัดเก็บก่อนย้ายระบบ</h1><p>อ่านข้อมูลและดาวน์โหลดต้นฉบับได้ งานใหม่และการร่างเอกสารใช้ระบบหลัก</p></header>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">กำลังเปิดคลังเอกสาร…</p>}
    {data&&!record&&<section className="pw-card"><h2>งานที่จัดเก็บไว้ ({data.cases.length})</h2>{selected&&<p role="alert">ไม่พบงานที่ระบุในคลังเอกสาร</p>}{data.cases.map(row=><button className="pw-case-row" key={row.id} onClick={()=>setSelected(row.id)}>{row.title}<small>{row.common.vendor} · {row.updatedAt.slice(0,10)}</small></button>)}</section>}
    {record&&<><section className="pw-card"><button onClick={()=>setSelected('')}>รายการงานที่จัดเก็บ</button><h2>{record.title}</h2><p>ร้านค้า: {record.common.vendor||'—'} · ยอดเงิน: {billValues(record).agreed||'—'} บาท</p><p>ครบกำหนดสัญญา: {record.contractDue||'ยังไม่กำหนด'}</p><h3>เลขที่และวันที่ที่บันทึกไว้</h3>{record.register.entries.map(row=><p key={row.id}>{row.prefix}/{row.number||'—'} · {row.confirmedDate||row.plannedDate||'—'} · {row.status}</p>)}</section><section className="pw-card"><h2>ไฟล์ต้นฉบับและหลักฐาน</h2>{data?.files.filter(file=>file.caseId===record.id).map(file=><p key={file.id}><a href={'/api/procurement/archive?fileId='+encodeURIComponent(file.id)}>{file.name}</a></p>)}{!data?.files.some(file=>file.caseId===record.id)&&<p>ยังไม่มีไฟล์จัดเก็บในงานนี้</p>}</section></>}
  </section>;
}
