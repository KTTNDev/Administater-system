"use client";
import {useEffect,useState} from "react";
import {Pause,Play} from "lucide-react";

// The same capability list is used on Home and the public welcome page.
// Segment by grapheme so Thai vowels and tone marks are never typed separately.
const capabilities=["ร่างบันทึกข้อความ","ร่างรายงานการประชุม","จัดการโครงการประจำปี","ติดตามงานและกำหนดส่ง","จัดเก็บเอกสาร"];
export function CapabilityTypewriter(){
 const [paused,setPaused]=useState(false),[hidden,setHidden]=useState(false);
 const [typing,setTyping]=useState({word:0,length:0,deleting:false});
 // Home explicitly opts into text cycling. Keep manual pause available even when
 // the OS reduces motion; CSS still suppresses caret/hover animation in that mode.
 useEffect(()=>{
  const visibility=()=>setHidden(document.hidden);
  visibility();document.addEventListener("visibilitychange",visibility);
  return()=>document.removeEventListener("visibilitychange",visibility);
 },[]);
 const chars=Array.from(new Intl.Segmenter("th",{granularity:"grapheme"}).segment(capabilities[typing.word]),x=>x.segment);
 useEffect(()=>{
  if(paused||hidden)return;
  const full=typing.length===chars.length;
  const timer=setTimeout(()=>setTyping(t=>t.deleting?(t.length===0?{word:(t.word+1)%capabilities.length,length:0,deleting:false}:{...t,length:t.length-1}):full?{...t,deleting:true}:{...t,length:t.length+1}),full&&!typing.deleting?2200:typing.deleting?40:85);
  return()=>clearTimeout(timer);
 },[typing,chars.length,paused,hidden]);
 return <div className="capability-typewriter">
  <div className="capability-copy">
   {/* Reserve the longest phrase's height at each viewport; controls never jump. */}
   {capabilities.map(word=><span className="capability-measure" aria-hidden="true" key={word}>{word}<i/></span>)}
   <span className="capability-live" aria-hidden="true" data-testid="welcome-typed">{chars.slice(0,typing.length).join("")}<i className={paused||hidden?"still":""}/></span>
  </div>
  <span className="welcome-sr">{capabilities.join(" · ")}</span>
  <button type="button" onClick={()=>setPaused(p=>!p)} aria-label={paused?"เล่นข้อความเคลื่อนไหว":"หยุดข้อความเคลื่อนไหว"}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
 </div>;
}
