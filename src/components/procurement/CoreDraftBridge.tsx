'use client';
import type {CoreDraftController} from './hooks/useCoreDrafts';
export function CoreDraftBridge({controller:c,disabled}:{controller:CoreDraftController;disabled:boolean}){
  const busy=disabled||c.busy||c.loading;
  return <section className="pw-card pw-bridge" aria-label="ร่างหนังสือในระบบหลัก">
    <div className="pw-row pw-bridge-bar">
      <button className="pw-primary" disabled={busy} onClick={()=>void c.saveSet()}>สร้าง/อัปเดตชุดร่างเอกสาร</button>
      <span className="pw-bridge-count">เชื่อม <b>{c.links.length}/15</b> ฉบับ</span>
      <button disabled={busy} onClick={()=>void c.reload()}>โหลดรายการล่าสุด</button>
      <span className="pw-bridge-note">การเปิดร่างเดิมจะคงข้อความที่แก้ไว้ · กดอัปเดตชุดร่างเมื่อต้องการซิงก์ข้อมูลกลางล่าสุด</span>
    </div>
    {(c.busy||c.loading)&&<p className="pw-bridge-status" role="status">{c.busy?'กำลังเตรียมร่างเอกสาร…':'กำลังเปิดรายการร่าง…'}</p>}
    {c.error&&<p role="alert" className="pw-error pw-bridge-status">{c.error}</p>}
    {c.message&&<p className="pw-bridge-status pw-info" role="status">{c.message}</p>}
    <details className="pw-bridge-details"><summary>ร่างหนังสือในระบบหลัก · {c.links.length}/15 ฉบับ</summary><div className="pw-bridge-list">{c.links.map(link=><div className="pw-case-row" key={link.doc_id}><span>{link.doc_id} · {link.draft?.subject??'ร่างอยู่ในถังขยะ'} · {link.copies} ชุด</span>{link.draft&&<button disabled={busy} onClick={()=>void c.open(link.doc_id)}>เปิดร่าง</button>}</div>)}</div></details>
  </section>;
}
