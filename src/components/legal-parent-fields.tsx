"use client";
import {useMemo,useState} from "react";
import {legalAncestors,legalDescendants,lawRelationships,type LegalRecord} from "@/lib/legal";
import s from "./legal-parent-fields.module.css";

/** Shared by the library dialog and the older in-draft library form. */
export function LegalParentFields({items,editingId="",parentId="",relationship="related",className=""}:{
 items:LegalRecord[];editingId?:string;parentId?:string;relationship?:LegalRecord["relationship"];className?:string;
}) {
 const [selected,setSelected]=useState(parentId),[query,setQuery]=useState("");
 const blocked=useMemo(()=>new Set([editingId,...legalDescendants(editingId,items)]),[editingId,items]);
 const available=items.filter(item=>!blocked.has(item.id));
 const options=available.filter(item=>item.id===selected||`${item.title} ${item.year} ${item.section}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <div className={`${s.fields} ${className}`}>
  <label className={s.wide}>ค้นหาเอกสารต้นทาง<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นชื่อระเบียบหรือปีฉบับ"/></label>
  <label className={s.wide}>อยู่ภายใต้เอกสาร<select name="parentId" value={selected} onChange={event=>setSelected(event.target.value)}>
   <option value="">ไม่มี — เป็นเอกสารตั้งต้น</option>
   {selected&&!available.some(item=>item.id===selected)&&<option value={selected}>ไม่พบเอกสารต้นทางเดิม — กรุณาเลือกใหม่</option>}
   {options.map(item=><option key={item.id} value={item.id}>{[...legalAncestors(item.id,items).map(x=>x.title),item.title].join(" › ")}{item.year?` (${item.year})`:""}</option>)}
  </select></label>
  {selected?<label className={s.wide}>ความสัมพันธ์กับเอกสารต้นทาง<select name="relationship" defaultValue={relationship}>{Object.entries(lawRelationships).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:<input type="hidden" name="relationship" value="related"/>}
 </div>;
}
