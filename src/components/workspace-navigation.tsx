"use client";
import {useEffect,useRef} from "react";
import {Home,Package,BarChart3,BookOpen,BriefcaseBusiness,CalendarDays,ChevronRight,Cloud,DoorOpen,Files,FolderOpen,HelpCircle,LogOut,PanelLeftClose,PanelLeftOpen,Plus,Settings2,Wallet,X} from "lucide-react";

export type WorkspaceView="home"|"inventory"|"register"|"budget"|"dashboard"|"templates"|"editor"|"settings"|"guide"|"office"|"bookings"|"calendar"|"laws"|"reports";
const shortLabels:Partial<Record<WorkspaceView,string>>={register:"ทะเบียนรับ–ส่ง",dashboard:"เอกสารของฉัน",templates:"แบบหนังสือ",reports:"ภาพรวม",office:"งานธุรการ",laws:"คลังกฎหมาย",guide:"คู่มือใช้งาน",settings:"ตั้งค่า"};
const groups=[
 {label:"เริ่มต้น",items:[{view:"home",label:"หน้าต้อนรับ",icon:Home}]},
 {label:"เอกสาร",items:[{view:"dashboard",label:"แดชบอร์ดเอกสาร",icon:FolderOpen},{view:"templates",label:"แบบหนังสือราชการ",icon:Files},{view:"reports",label:"ภาพรวมและรายงาน",icon:BarChart3}]},
 {label:"งานประจำ",items:[{view:"inventory",label:"พัสดุและครุภัณฑ์",icon:Package},{view:"register",label:"ทะเบียนรับ–ส่งหนังสือ",icon:BookOpen},{view:"office",label:"งานธุรการเทศบาล",icon:BriefcaseBusiness},{view:"budget",label:"โอนงบประมาณ",icon:Wallet},{view:"calendar",label:"ปฏิทินงาน",icon:CalendarDays},{view:"bookings",label:"จองห้องประชุม",icon:DoorOpen}]},
 {label:"คลังและการตั้งค่า",items:[{view:"laws",label:"คลังกฎหมายและระเบียบ",icon:BookOpen},{view:"guide",label:"คู่มือและแหล่งอ้างอิง",icon:HelpCircle},{view:"settings",label:"ตั้งค่าหน่วยงานและ Drive",icon:Settings2}]},
] as const;
type Props={view:WorkspaceView;count:number;connected:boolean;local:boolean;organization:string;collapsed:boolean;mobileOpen:boolean;onToggle:()=>void;onClose:()=>void;onNavigate:(view:WorkspaceView)=>void;onLogout:()=>void};

export function WorkspaceNavigation({view,count,connected,local,organization,collapsed,mobileOpen,onToggle,onClose,onNavigate,onLogout}:Props){
 const sidebar=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!mobileOpen)return;
  const previous=document.activeElement as HTMLElement|null;
  close.current?.focus();
  const handle=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();return;}
   if(event.key!=="Tab")return;
   const buttons=Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')||[]).filter(element=>element.getClientRects().length);
   const first=buttons[0],last=buttons.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  const resize=()=>{if(window.innerWidth>900)onClose();};
  document.addEventListener('keydown',handle);
  window.addEventListener('resize',resize);
  return()=>{document.removeEventListener('keydown',handle);window.removeEventListener('resize',resize);previous?.focus();};
 },[mobileOpen,onClose]);
 return <>
  {mobileOpen&&<button className="sidebar-scrim" tabIndex={-1} aria-label="ปิดแถบเมนู" onClick={onClose}/>}
  <aside id="workspace-navigation" ref={sidebar} className={`sidebar ${mobileOpen?"open":""}`} aria-label="เมนูหลัก">
   <div className="sidebar-heading"><a className="brand" href="#" aria-label="sarabun หน้าหลัก" onClick={event=>{event.preventDefault();onNavigate("home")}}><span className="brand-icon"><Files size={23}/></span><span className="brand-copy"><strong>sarabun</strong><small>พื้นที่ทำงานเอกสาร</small></span></a><button className="sidebar-toggle" aria-label={collapsed?"ขยายแถบเมนู":"ย่อแถบเมนู"} title={collapsed?"ขยายแถบเมนู":"ย่อแถบเมนู"} aria-expanded={!collapsed} onClick={onToggle}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button><button ref={close} className="sidebar-mobile-close" aria-label="ปิดเมนู" onClick={onClose}><X size={19}/></button></div>
   <button className="primary new-document" aria-label="สร้างหนังสือใหม่" title="สร้างหนังสือใหม่" onClick={()=>onNavigate("templates")}><Plus size={18}/><span>สร้างหนังสือใหม่</span></button>
   <div className="sidebar-scroll">{groups.map(group=><div className="sidebar-group" key={group.label}><div className="nav-caption">{group.label}</div><nav aria-label={group.label}>{group.items.map(item=>{const active=view===item.view||(view==="editor"&&item.view==="dashboard");return <button key={item.view} className={active?"active":""} aria-current={active?"page":undefined} aria-label={item.label} title={item.label} onClick={()=>onNavigate(item.view)}><item.icon size={18}/><span className="nav-label">{shortLabels[item.view]||item.label}</span>{item.view==="dashboard"&&<span className="nav-count" aria-hidden="true">{count}</span>}</button>})}</nav></div>)}</div>
   <div className="sidebar-bottom"><button className="drive-summary" aria-label="ตั้งค่า Google Drive" title={connected?"Google Drive เชื่อมต่อแล้ว":"ตั้งค่า Google Drive"} onClick={()=>onNavigate("settings")}><Cloud size={19}/><span><strong>Google Drive</strong><small><i className={connected?"dot green":"dot"}/>{connected?"เชื่อมต่อแล้ว":"ยังไม่ได้เชื่อมต่อ"}</small></span><ChevronRight size={15}/></button><div className="account"><div className="avatar">ส</div><div className="account-copy"><strong title={organization}>{organization||"พื้นที่ทำงานของคุณ"}</strong><small>{local?"ใช้งานบนเครื่องนี้":"ผู้ปฏิบัติงานสารบรรณ"}</small></div>{!local&&<button aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={onLogout}><LogOut size={17}/></button>}</div></div>
  </aside>
 </>;
}
