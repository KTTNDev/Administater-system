"use client";
import {useState,useEffect} from "react";
import {templateSlots,templateOutputVersion,type TemplateValues} from "@/lib/procurement-lab/template-model";
import "./template.css";
type Result={id:string;pages:number;changed:string[];sourceHash:string;preservedParts:number;outputVersion?:string};
type Props={initial:{values:TemplateValues;sourceHash:string;sourceName:string;referencePages:number};saved:{values:TemplateValues;result:Result}|null};
const url=(id:string,kind:string,page?:number)=>"/api/procurement-template/"+id+"/"+kind+(page?"/"+page:"");
export function TemplateEditor({initial,saved}:Props){
  const [values,setValues]=useState(saved?.values||initial.values),[last,setLast]=useState(saved?.values||initial.values),[result,setResult]=useState<Result|null>(saved?.result||null),[view,setView]=useState<"reference"|"result">(saved?"result":"reference"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const dirty=JSON.stringify(values)!==JSON.stringify(last),changed=templateSlots.filter(f=>values[f.key]!==initial.values[f.key]);
  useEffect(()=>{const listener=(e:BeforeUnloadEvent)=>{if(dirty||busy)e.preventDefault();};window.addEventListener("beforeunload",listener);return()=>window.removeEventListener("beforeunload",listener);},[dirty,busy]);
  async function build(){setBusy(true);setError("");try{const response=await fetch("/api/procurement-template",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({values})});const responseData=await response.json();if(!response.ok)throw Error(responseData.error);setResult(responseData.result);setLast({...values});setView("result");}catch(e){setError(e instanceof Error?e.message:"สร้างเอกสารไม่สำเร็จ");}finally{setBusy(false);}}
  const groups=[...new Set(templateSlots.map(f=>f.group))],shown=view==="reference"?"reference":result?.id||"reference",pages=view==="reference"?1:result?.pages||1;
  const outdated=view==="result"&&result?.outputVersion!==templateOutputVersion;
  return <main className="d07-template"><header><div><small>สารบรรณ / จัดซื้อจัดจ้าง / D07</small><h1>เอกสารจากแม่แบบต้นฉบับ</h1><p>{initial.sourceName} · รักษาตราครุฑ ตาราง และช่องลงนามเดิม</p></div><a href="/procurement/lab">ห้องทดลองฟังก์ชันเดิม</a></header>
  <div className="d07-intro"><b>กรอกข้อมูลลงสำเนา Word ต้นฉบับ</b><p>ตัวอย่างด้านขวาแสดงหน้าจาก Word ฉบับเดียวกับที่ดาวน์โหลด ข้อมูลตั้งต้นเป็นข้อมูลในไฟล์ตัวอย่างของคุณ กรุณาตรวจค่าก่อนนำไปใช้งาน</p></div>
  <div className="d07-layout"><section className="d07-form"><fieldset disabled={busy}>
    {groups.map(group=><section key={group}>
      <h2>{group}</h2>
      {templateSlots.filter(f=>f.group===group).map(f=><label key={f.key}>
        {f.label}
        {["intro","consideration","proposal","department"].includes(f.key)
          ? <textarea rows={3} maxLength={f.max} value={values[f.key]} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>
          : <input maxLength={f.max} value={values[f.key]} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>}
      </label>)}
    </section>)}
  </fieldset>
  <div className="d07-build"><p>{dirty?"มีข้อมูลแก้ไขที่ยังไม่ได้สร้างตัวอย่าง":"ข้อมูลตรงกับตัวอย่างล่าสุด"} · เปลี่ยนจากต้นฉบับ {changed.length} ช่อง</p><button disabled={busy} className="primary" onClick={()=>void build()}>{busy?"กำลังสร้างเอกสารด้วย Word…":"สร้างตัวอย่างและบันทึก"}</button><button disabled={busy} onClick={()=>{setValues({...initial.values});setView("reference");}}>คืนข้อมูลต้นฉบับ</button>{error&&<p role="alert">{error}</p>}</div>
  </section><section className="d07-preview"><nav><div className="d07-tabs"><button aria-pressed={view==="reference"} onClick={()=>setView("reference")}>ต้นฉบับอ้างอิง</button><button disabled={!result} aria-pressed={view==="result"} onClick={()=>setView("result")}>ฉบับที่สร้างล่าสุด</button></div><div>{!outdated&&<><a href={url(shown,"docx")}>{view==="reference"?"ดาวน์โหลดต้นฉบับอ้างอิง":"ดาวน์โหลด Word"}</a><a href={url(shown,"pdf")} target="_blank" rel="noreferrer">{view==="reference"?"เปิด PDF อ้างอิง":"เปิด PDF / พิมพ์ A4"}</a></>}</div></nav>
  <div className="d07-caption"><b>{view==="reference"?"ต้นฉบับอ้างอิง (คงสีเตือนเดิม)":`ฉบับใช้งานสีดำ · ${result?.changed.length||0} ช่องที่เปลี่ยน`} · {pages} หน้า</b>{outdated&&<p>ฉบับนี้สร้างก่อนปรับสีดำ กรุณากดสร้างตัวอย่างใหม่ก่อนใช้งาน</p>}{dirty&&view==="result"&&<p>แก้ข้อมูลแล้ว กรุณากดสร้างตัวอย่างเพื่อดูค่าล่าสุด</p>}{pages!==1&&<p className="d07-warning">จำนวนหน้าต่างจากต้นฉบับ ต้องตรวจการตัดหน้า ช่องลงนาม และใบต่อก่อนใช้งาน</p>}</div>
  <div className="d07-paper-scroll">{Array.from({length:pages},(_,i)=><img key={shown+"-"+i} src={url(shown,"png",i+1)} alt={`เอกสาร D07 ${view==="reference"?"ต้นฉบับ":"ฉบับที่สร้าง"} หน้า ${i+1}`} width={993} height={1404}/>)}</div>
  <p className="d07-note">ใช้ตำแหน่งและตัวอักษรจากต้นฉบับ ข้อความยาวขึ้นอาจทำให้ตัดหน้าใหม่ การปรับข้อความใบต่อเดิมและการเพิ่มย่อหน้าจะตรวจในขั้นถัดไป · Word จากหน้านี้ยังไม่ได้เชื่อมการนำกลับมาตรวจความต่าง</p>
  </section></div></main>;
}
