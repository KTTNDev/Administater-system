'use client';
import {useState} from 'react';
import {PdfPreview} from './pdf-preview';
const entries=[['หนังสือภายนอก',4],['หนังสือภายใน',7],['บันทึก',10],['ประทับตรา — ย่อหน้าเดียว',13],['ประทับตรา — หลายย่อหน้า',14],['คำสั่ง — ผู้มีอำนาจลงนาม',17],['คำสั่ง — รับคำสั่ง',18],['ระเบียบ',21],['ประกาศ',24],['หนังสือรับรอง',27],['รายงานการประชุม',30],['ตัวอย่างบันทึกท้ายเอกสาร',40]] as const;
export function TemplateReference(){
 const [open,setOpen]=useState(false),[page,setPage]=useState(4);
 return <section className="panel" style={{padding:20,marginBottom:24}}><button type="button" onClick={()=>setOpen(!open)}>{open?'ปิด':'เปิด'}คู่มือแบบหนังสือเพิ่มเติม 40 หน้า</button>{open&&<><p>คู่มือหลักหน้า 1–32 ระบุใช้ใน ทร. ส่วนท้ายเป็นเอกสารประกอบ แนวทางระยะบนมีทั้ง 2.5 ซม. และ 1.5 ซม. ต้องเลือกให้เหมาะกับหน่วยงาน</p><label>เลือกแบบในคู่มือ<select value={page} onChange={e=>setPage(Number(e.target.value))}>{entries.map(([label,p])=><option key={p} value={p}>{label} — หน้า {p}</option>)}</select></label><p>ระบบมีแบบหลักเหล่านี้อยู่แล้ว เลือกเริ่มร่างจากรายการด้านล่างได้ ตัวเลือกขอบบนและรับคำสั่งอยู่ในส่วนรูปแบบของฟอร์ม</p><div style={{maxWidth:720,margin:'auto'}}><PdfPreview url="/api/template-reference" title="คู่มือแบบหนังสือเพิ่มเติม" pageNumber={page}/></div></>}</section>;
}
