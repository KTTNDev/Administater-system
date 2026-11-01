"use client";
import {useMemo,type ReactNode} from "react";
import {BookOpen,ChevronDown,ChevronRight,Cloud,CornerDownRight,Plus} from "lucide-react";
import {legalTree,legalAncestors,legalDescendants,lawRelationships,lawStatuses,type LegalNode,type LegalRecord} from "@/lib/legal";
import s from "./law-library.module.css";

type Props={items:LegalRecord[];matches:LegalRecord[]|null;expanded:Set<string>;compare:string[];
 pending:boolean;connected:boolean;onToggle:(id:string)=>void;onRead:(id:string)=>void;
 onCompare:(id:string)=>void;onEdit:(record:LegalRecord)=>void;onAdd:(parent:LegalRecord)=>void;
 onUpload:(id:string)=>void;onDelete:(record:LegalRecord)=>void};

export function LegalTree({items,matches,expanded,compare,pending,connected,onToggle,onRead,onCompare,onEdit,onAdd,onUpload,onDelete}:Props) {
 const tree=useMemo(()=>legalTree(items),[items]);
 const matched=new Set(matches?.map(item=>item.id)),visible=new Set(matched);
 // Search keeps the matched edition with its ancestry and follow-on documents.
 if(matches)for(const item of matches){for(const parent of legalAncestors(item.id,items))visible.add(parent.id);for(const child of legalDescendants(item.id,items))visible.add(child);}
 function renderNode(node:LegalNode,depth=0):ReactNode {
  const x=node.record;if(matches&&!visible.has(x.id))return null;
  const children=node.children.filter(child=>!matches||visible.has(child.record.id));
  const open=!!matches||expanded.has(x.id),total=legalDescendants(x.id,items).size;
  const Heading=depth===0?"h2":"h3";
  return <article className={`${s.card} ${s.treeNode}`} key={x.id} data-law-id={x.id}>
   <div className={s.nodeHeading}><span className={s.nodeIcon} aria-hidden="true">{depth?<CornerDownRight size={20}/>:<BookOpen size={23}/>}</span><div>
    <div className={s.meta}>{x.category} · {x.year?`พ.ศ. ${x.year}`:"ไม่ระบุปี"}{depth>0&&` · ระดับ ${depth+1}`}</div>
    <Heading>{x.title}</Heading>
    <div className={s.badges}>{x.parentId&&<span className={s.relationship}>{lawRelationships[x.relationship]}</span>}<span className={s.status}>{lawStatuses[x.status]}</span>{matches&&!matched.has(x.id)&&<small>เอกสารในสายเดียวกัน</small>}</div>
   </div></div>
   {x.section&&<p>{x.section}</p>}{x.highlight&&<mark className={s.highlight}>หน้า {x.page} · {x.highlight}</mark>}
   {x.notes&&<p className={s.notes}>{x.notes}</p>}{x.tags&&<small className={s.tags}>#{x.tags.split(/[,，]/).map(v=>v.trim()).filter(Boolean).join(" #")}</small>}
   <div className={s.actions}>
    <button onClick={()=>onRead(x.id)}>อ่าน / ดูโน้ต</button>
    <button onClick={()=>onCompare(x.id)}>{compare.includes(x.id)?"✓ เลือกเทียบแล้ว":"เลือกเทียบ"}</button>
    <button onClick={()=>onAdd(x)}><Plus size={15}/>เพิ่มเอกสารต่อเนื่อง</button>
    <button onClick={()=>onEdit(x)}>แก้ไข</button>
   </div>
   <details className="library-file-actions"><summary>ไฟล์และการจัดเก็บ</summary><div className={s.actions}>
    {x.fileName&&<a href={`/api/legal/${x.id}`} target="_blank" rel="noreferrer">ดาวน์โหลด PDF</a>}
    {x.driveFileId&&<a href={`https://drive.google.com/file/d/${encodeURIComponent(x.driveFileId)}/view`} target="_blank" rel="noreferrer">เปิดไฟล์ Drive ↗</a>}
    <button disabled={pending||!x.fileName||!connected} onClick={()=>onUpload(x.id)}><Cloud size={15}/>อัปโหลด Drive</button>
    <button disabled={pending} onClick={()=>onDelete(x)}>ลบจากคลัง</button>
   </div></details>
   {children.length>0&&<><button className={s.branchToggle} aria-expanded={open} aria-controls={`law-children-${x.id}`} onClick={()=>onToggle(x.id)} disabled={!!matches}>
    {open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}เอกสารต่อเนื่อง {total} ฉบับ
   </button><div id={`law-children-${x.id}`} className={`${s.children} ${depth>=3?s.deepChildren:""}`} hidden={!open}>{open&&children.map(child=>renderNode(child,depth+1))}</div></>}
  </article>;
 }
 return <><p className={s.treeSummary}>{matches?`ตรงตัวกรอง ${matches.length} ฉบับ · แสดงพร้อมเอกสารต้นทางและเอกสารต่อเนื่อง`:`${tree.length} กลุ่มเอกสาร · ${items.length} ฉบับ`}</p><div className={`${s.cards} ${s.treeCards}`}>{tree.map(node=>renderNode(node))}</div></>;
}
