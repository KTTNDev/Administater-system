"use client";

import "./document-form.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Building2, ChevronDown, FileText, ListChecks, Paperclip, PenLine, Settings2, Users } from "lucide-react";
import type { Draft } from "@/lib/document";
import { organizations } from "@/lib/templates";
import { BodyEditor } from "./body-editor";
import { ConclusionPicker } from "./writing-assistants";

const MinutesEditor=dynamic(()=>import("./minutes-editor").then(m=>m.MinutesEditor));
const DocumentTools=dynamic(()=>import("./document-tools").then(m=>m.DocumentTools));
const StructuredBody=dynamic(()=>import("./document-tools").then(m=>m.StructuredBody));
const ReviewChain=dynamic(()=>import("./document-tools").then(m=>m.ReviewChain));
const LegalLibrary=dynamic(()=>import("./document-tools").then(m=>m.LegalLibrary));
const AttachmentEditor=dynamic(()=>import("./attachment-editor").then(m=>m.AttachmentEditor));
const AppendixPagesEditor=dynamic(()=>import("./appendix-pages-editor").then(m=>m.AppendixPagesEditor));
const AppendixEditor=dynamic(()=>import("./appendix-editor").then(m=>m.AppendixEditor));
const FloatingItemsEditor=dynamic(()=>import("./floating-items-editor").then(m=>m.FloatingItemsEditor));

export function FormHelp({children}:{children:ReactNode}){
  return <details className="form-help"><summary>คำแนะนำ</summary><div>{children}</div></details>;
}

function Section({id,title,icon,children,tone="green"}:{id:string;title:string;icon:ReactNode;children:ReactNode;tone?:string}){
  return <details id={`form-${id}`} className={`form-section document-section tone-${tone}`} open>
    <summary><span className="section-icon">{icon}</span><strong>{title}</strong><ChevronDown size={17}/></summary>
    <div className="field-grid">{children}</div>
  </details>;
}

export function DocumentFormNav({external}:{external:boolean}){
  const cancelMotion=useRef<()=>void>(()=>{});
  const [selected,setSelected]=useState("");
  useEffect(()=>()=>cancelMotion.current(),[]);
  function jump(id:string){
    cancelMotion.current();
    const section=document.getElementById(`form-${id}`);
    if(!section)return;
    if(section instanceof HTMLDetailsElement)section.open=true;
    setSelected(id);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let parent=section.parentElement;
    while(parent&&!/(auto|scroll)/.test(getComputedStyle(parent).overflowY))parent=parent.parentElement;
    const scroller=parent??document.documentElement;
    const nav=section.closest(".form-pane")?.querySelector(".form-jump-nav");
    const start=scroller.scrollTop;
    const top=parent?parent.getBoundingClientRect().top+parent.clientTop:0;
    const destination=Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,start+section.getBoundingClientRect().top-top-(nav?.getBoundingClientRect().height??76)-16));
    const duration=reduced?0:Math.min(850,480+Math.abs(destination-start)*.12);
    let frame=0;
    let glow:Animation|undefined;
    const cancel=()=>{
      cancelAnimationFrame(frame);
      glow?.cancel();
      for(const event of ["wheel","touchstart","pointerdown","keydown"])window.removeEventListener(event,cancel,true);
    };
    cancelMotion.current=cancel;
    for(const event of ["wheel","touchstart","pointerdown","keydown"])window.addEventListener(event,cancel,{capture:true,passive:true});
    const finish=()=>{
      const heading=section.querySelector<HTMLElement>(":scope > summary, :scope > h3")??section;
      if(!heading.hasAttribute("tabindex"))heading.tabIndex=-1;
      heading.focus({preventScroll:true});
      if(!reduced)glow=heading.animate([{backgroundColor:"#d8efe6",boxShadow:"inset 3px 0 #23866b"},{backgroundColor:getComputedStyle(heading).backgroundColor,boxShadow:"inset 0 0 transparent"}],{duration:1100,easing:"ease-out"});
      if(glow)glow.onfinish=cancel;else cancel();
    };
    const began=performance.now();
    const step=(now:number)=>{
      const progress=duration?Math.min(1,(now-began)/duration):1;
      const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      scroller.scrollTo({top:start+(destination-start)*eased,behavior:"instant"});
      if(progress<1)frame=requestAnimationFrame(step);else finish();
    };
    frame=requestAnimationFrame(step);
  }
  const links=[{id:"header",label:"ส่วนหัว",icon:Building2},...(external?[{id:"attachments",label:"สิ่งที่ส่งมาด้วย",icon:Paperclip}]:[]),{id:"body",label:"เนื้อหา",icon:FileText},{id:"signing",label:"ส่วนท้าย",icon:PenLine},...(!external?[{id:"attachments",label:"แนบท้าย",icon:Paperclip}]:[]),{id:"options",label:"เครื่องมือ",icon:Settings2},{id:"review",label:"ตรวจทาน",icon:ListChecks}];
  return <nav className="form-jump-nav" aria-label="ไปยังส่วนของแบบฟอร์ม">{links.map(({id,label,icon:Icon})=><button key={id} type="button" className={selected===id?"is-selected":undefined} onClick={()=>jump(id)}><Icon size={16}/><span>{label}</span></button>)}</nav>;
}

type Props={
  draft:Draft;
  organization:typeof organizations[number];
  onChange:(patch:Partial<Draft>)=>void;
  onBusy:(busy:boolean)=>void;
  sources:Record<string,string>;
  onSources:(sources:Record<string,string>)=>void;
  pages:number;
};

export function DocumentForm({draft:d,organization,onChange:change,onBusy,sources,onSources,pages}:Props){
  const external=d.type==="external",memo=["internal","memorandum"].includes(d.type),minutes=d.type==="minutes";
  const correspondence=external||memo,directed=correspondence||d.type==="stamped";
  const issued=["order","regulation","rule","announcement","statement","news","certificate","stamped"].includes(d.type);
  const signed=!["minutes","stamped","other","news","statement"].includes(d.type);
  const field=(key:keyof Draft,label:string,options:{wide?:boolean;required?:boolean;textarea?:boolean;type?:string;placeholder?:string}={})=><label className={options.wide?"wide":undefined} key={key}>{label}{options.required&&<span className="required"> *</span>}{options.textarea?<textarea rows={3} required={options.required} value={String(d[key])} maxLength={key==="attendees"||key==="absentees"||key==="participants"?10000:2000} placeholder={options.placeholder} onChange={e=>change({[key]:e.target.value})}/>:<input type={options.type||"text"} value={String(d[key])} required={options.required} maxLength={key==="subject"?300:2000} placeholder={options.placeholder} onChange={e=>change({[key]:options.type==="number"?Number(e.target.value):e.target.value})}/>}</label>;
  const date=field("date",minutes?"วันที่ประชุม":"วันที่หนังสือ",{type:"date"});
  const subject=field("subject",minutes?"ชื่อการประชุม":"เรื่อง / ชื่อร่าง",{required:true,wide:true,placeholder:"ระบุเรื่องของหนังสือ"});
  const agency=field("organization","ส่วนราชการเจ้าของหนังสือ",{required:true,wide:!external&&d.type!=="certificate"});
  const contact=<>{field("department","หน่วยงานเจ้าของเรื่อง")}{field("phone","โทรศัพท์")}{external&&field("email","อีเมลติดต่อ",{wide:true})}</>;
  const attachmentCount=d.attachmentFiles.length+d.appendixPages.length+d.appendixImages.length;
  const attachments=<section id="form-attachments" className="form-section document-section tone-amber attachment-group" aria-label={external?"สิ่งที่ส่งมาด้วย":"เอกสารแนบท้าย"}>
    <h3 className="section-heading"><span className="section-icon"><Paperclip size={19}/></span>{external?"สิ่งที่ส่งมาด้วย":"เอกสารแนบท้าย"}<span className="section-count">{attachmentCount?`${attachmentCount} รายการ`:"ถ้ามี"}</span></h3>
    {external&&<div className="field-grid"><label className="wide">สิ่งที่ส่งมาด้วยเพิ่มเติม (ถ้ามี)<textarea rows={2} maxLength={2000} value={d.additionalEnclosures} onChange={e=>change({additionalEnclosures:e.target.value})} placeholder="รายการที่ส่งแยก เช่น แบบแปลน จำนวน 1 ชุด"/></label><p className="compact-hint wide">เอกสารและรูปที่เพิ่มด้านล่างจะปรากฏในสิ่งที่ส่งมาด้วยให้อัตโนมัติ</p></div>}
    <div className="attachment-options">
      {correspondence&&<AppendixPagesEditor pages={d.appendixPages} onChange={appendixPages=>change({appendixPages})}/>}
      <AppendixEditor title={d.appendixTitle} layout={d.appendixLayout} images={d.appendixImages} sources={sources} onTitle={appendixTitle=>change({appendixTitle})} onLayout={appendixLayout=>change({appendixLayout})} onImages={appendixImages=>change({appendixImages})} onSources={onSources} onBusy={onBusy}/>
      {correspondence&&<AttachmentEditor draft={d} onChange={attachmentFiles=>change({attachmentFiles})} onBusy={onBusy} onPhrase={attachmentPhrase=>change({attachmentPhrase})}/>}
    </div>
  </section>;

  return <>
    <Section id="header" title={minutes?"ข้อมูลการประชุม":"ส่วนหัวหนังสือ"} icon={<Building2 size={19}/>}>
      {["stamped","certificate"].includes(d.type)&&field("subject","ชื่อร่างในรายการเอกสาร",{wide:true,required:true})}
      {!minutes&&<div className="agency-fill wide"><label>กรอกข้อมูลหน่วยงานอัตโนมัติ<select value="" onChange={e=>{const org=e.target.value==="saved"?organization:organizations[Number(e.target.value)];if(org)change({organization:org.name,department:org.department,address:org.address,phone:org.phone})}}><option value="">เลือกหน่วยงาน หรือพิมพ์เอง</option>{organization.name&&<option value="saved">{organization.name}</option>}{organizations.map((org,i)=><option key={i} value={i}>{org.name}</option>)}</select></label></div>}
      {<details className="header-marks wide" open={d.urgency!=="ปกติ"||d.confidentiality!=="ปกติ"}><summary>ชั้นความเร็ว / ชั้นความลับ <span>{[d.urgency,d.confidentiality].filter(v=>v!=="ปกติ").join(" · ")||"ปกติ"}</span></summary><div className="field-grid"><label>ชั้นความเร็ว<select aria-label="ชั้นความเร็ว" value={d.urgency} onChange={e=>change({urgency:e.target.value as Draft["urgency"]})}>{["ปกติ","ด่วน","ด่วนมาก","ด่วนที่สุด"].map(v=><option key={v}>{v}</option>)}</select></label><label>ชั้นความลับ<select aria-label="ชั้นความลับ" value={d.confidentiality} onChange={e=>change({confidentiality:e.target.value as Draft["confidentiality"]})}>{["ปกติ","ลับ","ลับมาก","ลับที่สุด"].map(v=><option key={v}>{v}</option>)}</select></label>{d.confidentiality!=="ปกติ"&&<>{field("secretSetNumber","เลขที่ชุด",{type:"number"})}{field("secretSetTotal","จำนวนชุดทั้งหมด",{type:"number"})}</>}</div></details>}
      {minutes?<>{subject}{field("meetingNo","ครั้งที่",{required:true})}{date}{field("location","สถานที่",{required:true,wide:true})}<details className="header-marks wide" open={!d.organization}><summary>หน่วยงานเจ้าของรายงาน</summary>{agency}</details></>:memo?<>{agency}{contact}{field("number","เลขที่หนังสือ")}{date}{subject}</>:external||d.type==="certificate"?<>{field("number","เลขที่หนังสือ")}{agency}{field("address","ที่อยู่ส่วนราชการ",{textarea:true,wide:true})}{external&&<>{date}{subject}</>}</>:<>
        {d.type!=="stamped"&&agency}
        {!["news","other","announcement"].includes(d.type)&&field("number",["regulation","rule","statement"].includes(d.type)?"ฉบับที่ (ถ้ามี)":"เลขที่หนังสือ")}
        {d.type!=="stamped"&&subject}
        {(["regulation","rule","other"].includes(d.type))&&date}
      </>}
      {directed&&<>{correspondence&&<label>คำขึ้นต้น<select value={d.salutation} onChange={e=>change({salutation:e.target.value})}><option>เรียน</option><option>กราบเรียน</option><option>นมัสการ</option></select></label>}{field("recipient",d.type==="stamped"?"ถึง":"ผู้รับหนังสือ",{required:true,wide:!correspondence})}{external&&field("reference","อ้างถึง (ถ้ามี)",{textarea:true,wide:true,placeholder:"ชื่อหนังสือ เลขที่ และวันที่"})}</>}
    </Section>
    {external&&attachments}
    {minutes&&<Section id="attendees" title="ผู้เข้าประชุม" icon={<Users size={19}/>}>{field("attendees","ผู้มาประชุม",{textarea:true,wide:true,required:true})}{field("absentees","ผู้ไม่มาประชุม พร้อมเหตุผล",{textarea:true,wide:true})}{field("participants","ผู้เข้าร่วมประชุม",{textarea:true,wide:true})}{field("startTime","เริ่มประชุมเวลา",{type:"time",required:true})}</Section>}
    <Section id="body" title={minutes?"เนื้อหาการประชุม":"เนื้อหาหนังสือ"} icon={<FileText size={19}/>} tone="blue">
      {minutes&&<MinutesEditor draft={d} onChange={change}/>}
      {!(minutes&&d.minutesMode==="agenda")&&<><StructuredBody draft={d} onChange={change}/>{d.bodyMode==="free"&&<div className="wide"><label htmlFor="document-body">{minutes?"ระเบียบวาระ ความคิดเห็น และมติที่ประชุม":"ข้อความ"}<span className="required"> *</span></label><BodyEditor id="document-body" value={d.body} required onChange={body=>change({body})}/><ConclusionPicker draft={d} onChange={change}/></div>}</>}
      {["order","regulation","rule"].includes(d.type)&&field("effectiveDate","ข้อกำหนดวันมีผลใช้บังคับ",{wide:true,textarea:true,placeholder:"เช่น ทั้งนี้ ตั้งแต่วันที่ … เป็นต้นไป"})}
      <div className="wide"><FormHelp>ขึ้นบรรทัดใหม่เพื่อเริ่มย่อหน้า ระบบย่อหน้า 2.5 ซม. ให้อัตโนมัติ เลือกข้อความแล้วกดตัวหนา หรือแทรกตารางจากแถบเครื่องมือได้</FormHelp></div>
    </Section>
    <Section id="signing" title={minutes?"ปิดการประชุม":signed?"ส่วนท้ายและผู้ลงนาม":"ส่วนท้ายหนังสือ"} icon={<PenLine size={19}/>} tone="violet">
      {minutes?<>{field("endTime","เลิกประชุมเวลา",{type:"time",required:true})}{field("recorder","ผู้จดรายงานการประชุม",{required:true,wide:true})}</>:<>
        {external&&field("closing","คำลงท้าย",{wide:true,required:true})}
        {d.type==="stamped"&&agency}
        {issued&&!["regulation","rule"].includes(d.type)&&date}
        {d.type==="order"&&field("orderReceivedBy","รับคำสั่ง (เฉพาะกรณีมีอำนาจรับคำสั่ง)",{wide:true})}
        {signed&&<>{field("signer","ชื่อ–นามสกุลผู้ลงนาม",{required:true,wide:true})}{field("position","ตำแหน่ง",{textarea:true,required:true,wide:true})}</>}
        {(external||d.type==="stamped")&&<><div className="field-divider wide">ส่วนราชการเจ้าของเรื่อง</div>{contact}{external&&field("copies","สำเนาส่ง (ถ้ามี)",{wide:true,textarea:true})}</>}
        {d.type==="certificate"&&<><label className="check-label wide"><input type="checkbox" checked={d.certificatePhotoArea} onChange={e=>change({certificatePhotoArea:e.target.checked})}/>เพิ่มพื้นที่รูปถ่ายและผู้ได้รับการรับรอง</label>{d.certificatePhotoArea&&field("certificateRecipient","ชื่อผู้ได้รับการรับรอง",{wide:true})}</>}
        {d.type==="other"&&<p className="compact-hint wide">แบบนี้ไม่มีส่วนลงนามตายตัว เพิ่มข้อความที่ต้องการไว้ในเนื้อหาได้</p>}
        {(signed||d.type==="stamped")&&<div className="wide"><FormHelp>{d.type==="stamped"?"ตรวจว่ารายการนี้เข้าเงื่อนไขหนังสือประทับตรา และต้องประทับตราชื่อส่วนราชการด้วยหมึกแดง พร้อมผู้รับผิดชอบลงชื่อย่อกำกับ":"การกรอกชื่อยังไม่ใช่การลงลายมือชื่อ ต้องตรวจอำนาจผู้ลงนามก่อนออกหนังสือ"}</FormHelp></div>}
      </>}
    </Section>
    <ReviewChain draft={d} onChange={change}/>
    {!external&&attachments}
    <section id="form-options" className="form-options" aria-label="เครื่องมือเพิ่มเติม">
      <h3 className="section-heading"><Settings2 size={19}/>เครื่องมือเพิ่มเติม</h3>
      <DocumentTools draft={d} onChange={change}/>
      <FloatingItemsEditor items={d.floatingItems} pages={d.copyMark==="สำเนาคู่ฉบับ"?Math.max(1,Math.floor(pages/2)):pages} sources={sources} onChange={floatingItems=>change({floatingItems})} onSources={onSources} onBusy={onBusy}/>
      <LegalLibrary draft={d} onChange={change}/>
    </section>
  </>;
}
