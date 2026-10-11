"use client";
import { useRef } from "react";
import { Bold,Table2 } from "lucide-react";

export function BodyEditor({value,onChange,required=false,id,rows=12,placeholder="พิมพ์เนื้อหาหนังสือ… ใช้ **ข้อความ** เพื่อทำตัวหนา หรือกดแทรกตาราง"}:{value:string;onChange:(value:string)=>void;required?:boolean;id?:string;rows?:number;placeholder?:string}) {
 const ref=useRef<HTMLTextAreaElement>(null);
 function wrapBold(){
  const input=ref.current;if(!input)return;
  const start=input.selectionStart,end=input.selectionEnd,selected=value.slice(start,end);
  const next=value.slice(0,start)+`**${selected||"ข้อความตัวหนา"}**`+value.slice(end);onChange(next);
  requestAnimationFrame(()=>{input.focus();const a=start+2,b=a+(selected||"ข้อความตัวหนา").length;input.setSelectionRange(a,b)});
 }
 function insertTable(){
  const input=ref.current;if(!input)return;
  const selectionEnd=input.selectionEnd;
  const insideBoldSelection=value.slice(Math.max(0,input.selectionStart-2),input.selectionStart)==='**'&&value.slice(selectionEnd,selectionEnd+2)==='**';
  const start=selectionEnd+(insideBoldSelection?2:0);
  const table="| หัวข้อ | รายละเอียด |\n| --- | --- |\n|  |  |\n";
  const prefix=value.slice(0,start),separator=prefix&&!prefix.endsWith("\n")?"\n":"";
  const next=prefix+separator+table+value.slice(start);onChange(next);
  requestAnimationFrame(()=>{input.focus();const cursor=(prefix+separator+"| หัวข้อ | รายละเอียด |\n| --- | --- |\n| ").length;input.setSelectionRange(cursor,cursor)});
 }
 return <div className="body-editor">
  <div className="body-format-toolbar" role="toolbar" aria-label="จัดรูปแบบข้อความ">
   <button type="button" className="secondary" onClick={wrapBold} title="ทำข้อความที่เลือกเป็นตัวหนา"><Bold size={17}/>ตัวหนา</button>
   <button type="button" className="secondary" onClick={insertTable} title="แทรกตาราง 2 คอลัมน์"><Table2 size={17}/>แทรกตาราง</button>
  </div>
  <textarea id={id} ref={ref} required={required} value={value} rows={rows} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
 </div>;
}
