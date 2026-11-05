'use client';
import type {CSSProperties} from 'react';
import {ArrowRight,BarChart3,BookOpen,BriefcaseBusiness,CalendarDays,DoorOpen,FileText,FolderOpen,HelpCircle,ListTodo,Package,Settings2,Wallet} from 'lucide-react';
import {homeCardFocus,homeCardImage,type HomeCard,type HomeLayout,type HomeTarget} from '@/lib/home-layout';
import {focusPosition} from '@/lib/image-focus';
const icons={templates:FileText,dashboard:FolderOpen,tasks:ListTodo,projects:FolderOpen,register:BookOpen,inventory:Package,reports:BarChart3,budget:Wallet,office:BriefcaseBusiness,calendar:CalendarDays,bookings:DoorOpen,laws:BookOpen,guide:HelpCircle,settings:Settings2};
export function HomeShortcutCard({card,onClick}:{card:HomeCard;onClick:()=>void}) {
 const Icon=icons[card.target],focus=homeCardFocus(card);return <button type="button" title={card.label} data-home-card={card.id} data-home-photo={card.background==='image'} data-workspace-category={card.tone} onClick={onClick} style={{'--home-card-image':homeCardImage(card),'--home-card-opacity':card.opacity,'--home-card-position':card.position,'--home-card-focus':focusPosition(focus),'--home-card-scale':focus.zoom/100,'--home-card-size':card.background==='image'?'cover':undefined} as CSSProperties}><Icon size={25}/><span>{card.label}</span><ArrowRight size={18}/></button>;
}
export function HomeShortcuts({layout,onChoose}:{layout:HomeLayout;onChoose:(target:HomeTarget)=>void}) {
 const visible=layout.cards.filter(c=>c.visible);
 return visible.length?<div className="wd-launchers home-custom-shortcuts" data-card-size={layout.cardSize} role="group" aria-label="เลือกงานในระบบ">{visible.map(card=><HomeShortcutCard key={card.id} card={card} onClick={()=>onChoose(card.target)}/>)}</div>:<div className="home-shortcuts-empty">ยังไม่มีทางลัดบนหน้าหลัก <button type="button" onClick={()=>onChoose('settings')}>เพิ่มทางลัดในตั้งค่า</button></div>;
}
