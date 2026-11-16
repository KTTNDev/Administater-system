'use client';
import {useState} from 'react';
import {templates,type DocumentType} from '@/lib/templates';
import {procurementDocumentNames,procurementTypeName,type ProcurementDocumentCode} from '@/lib/procurement-document-types';
import type {ProcurementInput} from '@/lib/procurement';
import styles from './procurement-workspace.module.css';
import {suiteCodes} from '@/lib/procurement-workflow-model';
export function ProcurementDocumentCatalog({data,onChange}:{data:ProcurementInput;onChange:(value:Partial<ProcurementInput>)=>void}){
 const [filter,setFilter]=useState('all');
 return <section className={styles.panel}><h2>ชุดเอกสารของงาน แยกตามประเภทหนังสือ</h2><p>ใช้ประเภทเดียวกับหน้าร่างหนังสือทั้ง 13 แบบ รหัส D01–D14 เป็นลำดับงาน ส่วนประเภทด้านล่างเป็นชนิดของเอกสารแต่ละฉบับ</p>
 <label>ดูประเภทหนังสือ<select aria-label="ดูประเภทหนังสือของชุดงาน" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">ทุกประเภท</option>{templates.map(type=><option key={type.id} value={type.id}>{procurementTypeName(type.id)}</option>)}</select></label>
 {templates.filter(type=>filter==='all'||type.id===filter).map(type=>{const codes=(Object.keys(procurementDocumentNames) as ProcurementDocumentCode[]).filter(code=>data.documentTypes[code]===type.id);if(!codes.length)return null;return <section key={type.id} className={styles.typeGroup}><h3>{procurementTypeName(type.id)} <small>{codes.length} ฉบับ/หมวด</small></h3>{codes.map(code=><div className={styles.typeRow} key={code}><span><strong>{code} · {procurementDocumentNames[code]}</strong><small>{suiteCodes.includes(code as typeof suiteCodes[number])?'ร่างและดูตัวอย่างจากข้อมูลกลางได้':code==='D10'||code==='E01'||code==='V01'||code==='P01'||code==='OTHER'?'แนบไฟล์หรือภาพหลักฐาน':'แนบไฟล์ได้ · รอเชื่อมแม่แบบร่าง'}</small></span><label><span className={styles.srOnly}>ประเภทหนังสือ {code}</span><select aria-label={'ประเภทหนังสือ '+code} value={data.documentTypes[code]} onChange={e=>onChange({documentTypes:{...data.documentTypes,[code]:e.target.value as DocumentType}})}>{templates.map(item=><option key={item.id} value={item.id}>{procurementTypeName(item.id)}</option>)}</select></label></div>)}</section>;})}
 <p>การเปลี่ยนประเภทใช้จัดหมวดชุดงาน แม่แบบยังคงรูปแบบต้นฉบับของฉบับนั้น ไม่เปลี่ยนบันทึกข้อความให้เป็นคำสั่งโดยอัตโนมัติ</p>
 </section>;
}
