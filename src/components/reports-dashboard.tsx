'use client';
import {useEffect,useState} from 'react';
import {BarChart3,Files,ClipboardList,CalendarDays,DoorOpen,Download,RefreshCw,ArrowUpRight} from 'lucide-react';
import {getReports} from '@/app/storage-actions';
import {today} from '@/lib/document';
import {template} from '@/lib/templates';
import {officeKinds} from '@/lib/office';
import {WorkspaceHeading,DetailNote} from './workspace-ui';

export function ReportsDashboard(){
 const [data,setData]=useState<Awaited<ReturnType<typeof getReports>>|null>(null),[month,setMonth]=useState(today().slice(0,7)),[error,setError]=useState('');
 function refresh(){setError('');getReports().then(setData).catch(()=>setError('โหลดรายงานไม่สำเร็จ'));}
 useEffect(()=>{refresh();},[]);
 if(!data)return <main className="page-main workspace-page"><WorkspaceHeading icon={BarChart3} title="ภาพรวมและรายงานระบบ"/><p role="status">{error||'กำลังรวบรวมสถิติ…'}</p>{error&&<button onClick={refresh}>ลองโหลดใหม่</button>}</main>;
 const inMonth=(v:string)=>!month||v?.startsWith(month);
 const docs=data.documents.filter(d=>inMonth(d.date)),office=data.office.filter(o=>inMonth(o.date)),bookings=data.bookings.filter(b=>inMonth(b.date)),calendar=data.calendar.filter(e=>inMonth(e.date));
 const audit=data.audit.filter(a=>inMonth(new Date(a.at).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})));
 const cards=[{label:'หนังสือ',value:docs.length,url:'dashboard',icon:Files},{label:'งานและทะเบียนธุรการ',value:office.length,url:'office',icon:ClipboardList},{label:'นัดหมาย',value:calendar.length,url:'calendar',icon:CalendarDays},{label:'การจองห้อง',value:bookings.length,url:'bookings',icon:DoorOpen}];
 const pending=docs.filter(d=>d.syncedVersion!==d.version).length,overdue=data.office.filter(o=>['task','incoming','outgoing','meeting'].includes(o.kind)&&o.status!=='done'&&o.due&&o.due<today()).length;
 const docTypes=Array.from(new Set(docs.map(d=>d.type))).map(type=>({label:template(type).name,value:docs.filter(d=>d.type===type).length}));
 const lawTypes=Array.from(new Set(data.laws.map(l=>l.category||'อื่น ๆ'))).map(category=>({label:category,value:data.laws.filter(l=>(l.category||'อื่น ๆ')===category).length}));
 function csv(){const rows=[...cards.map(c=>[c.label,c.value]),['คลังกฎหมายทั้งหมด',data!.laws.length],['ห้องประชุมทั้งหมด',data!.rooms],['หนังสือรอซิงก์',pending],['งานค้างเกินกำหนด (ทุกเดือน)',overdue]];const text='\ufeff'+[['รายการ','จำนวน'],...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`รายงานระบบ-${month||'ทั้งหมด'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <main className="page-main workspace-page reports-overview"><WorkspaceHeading icon={BarChart3} title="ภาพรวมและรายงานระบบ" description="ภาพรวมจากข้อมูลที่บันทึกไว้" actions={<button className="secondary" onClick={refresh}><RefreshCw size={16}/>โหลดล่าสุด</button>}/>
  <div className="report-controls"><label>ช่วงเวลา<input aria-label="เดือนรายงาน" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className="secondary" onClick={()=>setMonth('')}>ทุกช่วงเวลา</button><button className="secondary report-export" onClick={csv}><Download size={16}/>ส่งออกรายงาน CSV</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className="report-totals">{cards.map(({icon:Icon,...card})=><a key={card.url} href={`/?view=${card.url}`}><span><Icon size={20} aria-hidden="true"/>{card.label}<ArrowUpRight size={15}/></span><strong>{card.value.toLocaleString('th-TH')}</strong><small>ในช่วงที่เลือก</small></a>)}</div>
  <section className="report-followup"><h2>งานที่ต้องติดตาม</h2><div><a href="/?view=dashboard"><span>หนังสือรอซิงก์</span><strong>{pending}</strong></a><a href="/?view=office"><span>เกินกำหนด · ทุกเดือน</span><strong>{overdue}</strong></a><span>นัดหมายเสร็จสิ้น <strong>{calendar.filter(e=>e.status==='done').length}</strong></span><span>ยกเลิกการจอง <strong>{bookings.filter(b=>b.status==='cancelled').length}</strong></span></div></section>
  <div className="report-charts"><section><h2>หนังสือตามประเภท</h2><p>{docs.length} ฉบับในช่วงที่เลือก</p><Bars rows={docTypes} total={docs.length}/></section><section><h2>คลังกฎหมายและระเบียบ</h2><p>{data.laws.length} รายการ · ทุกช่วงเวลา</p><Bars rows={lawTypes} total={data.laws.length}/></section></div>
  <DetailNote title="หมวดงานธุรการและข้อมูลคลัง"><div className="report-details"><section><h2>งานธุรการในช่วงที่เลือก</h2><Bars rows={Object.entries(officeKinds).map(([key,label])=>({label,value:office.filter(o=>o.kind===key).length}))} total={office.length}/></section><section><h2>ข้อมูลคลังทั้งหมด</h2><p>ห้องประชุม {data.rooms} ห้อง</p><p>PDF ในคลัง {data.laws.filter(l=>l.hasFile).length} ไฟล์</p><p>ไฟล์รวม {(data.laws.reduce((sum,l)=>sum+l.bytes,0)/1024/1024).toFixed(2)} MB</p><p>มีลิงก์ Drive {data.laws.filter(l=>l.driveFileId).length} รายการ</p></section></div></DetailNote>
  <DetailNote title={`กิจกรรมล่าสุด · ${audit.length} รายการในช่วงที่เลือก`}><p>แสดงไม่เกิน 15 รายการ จาก 1,000 กิจกรรมล่าสุดที่ระบบเก็บไว้</p><ol className="activity-list">{audit.slice(0,15).map((a,i)=><li key={i}><span>{a.action.includes('delete')?'ลบรายการ':a.action.includes('cancel')?'ยกเลิกรายการ':a.action.includes('drive')?'จัดเก็บบน Drive':a.action.includes('update')?'แก้ไขข้อมูล':'เพิ่ม / บันทึกข้อมูล'}</span><time>{new Date(a.at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</time></li>)}</ol></DetailNote>
  <DetailNote title="วิธีนับข้อมูลในรายงาน"><p>กรองหนังสือตามวันที่หนังสือ งานตามวันที่บันทึก นัดและการจองตามวันเริ่ม คลังและห้องแสดงยอดทั้งหมด ไม่ใช่สถิติผู้ใช้งานรายบุคคลหรือจำนวนเปิดหน้าเว็บ</p></DetailNote>
 </main>;
}

function Bars({rows,total}:{rows:{label:string;value:number}[];total:number}){
 if(!total)return <p className="report-no-data">ยังไม่มีข้อมูลในช่วงนี้</p>;
 return <div className="report-bars">{rows.map(row=><div key={row.label}><span>{row.label}<strong>{row.value}</strong></span><progress max={Math.max(total,1)} value={row.value} aria-label={`${row.label} ${row.value} จาก ${total}`}/></div>)}</div>;
}
