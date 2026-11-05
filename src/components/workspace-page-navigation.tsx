'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Home,Maximize2,Minimize2,Menu,PanelLeftClose,RefreshCw} from 'lucide-react';
import {previousWorkspaceView,visitWorkspaceView,workspaceViewLabels,type WorkspaceLocation,type WorkspaceView} from '@/lib/workspace-location';

export function useWorkspaceLocation(initial:WorkspaceView){
 const [location,setLocation]=useState<WorkspaceLocation>(()=>({current:initial,past:[]}));
 const setView=useCallback((view:WorkspaceView)=>setLocation(current=>visitWorkspaceView(current,view)),[]);
 const goBack=useCallback(()=>setLocation(previousWorkspaceView),[]);
 return {view:location.current,setView,goBack,previousView:location.past.at(-1)};
}
export function useWorkspaceFullscreen(onError:(message:string)=>void){
 const [fullscreen,setFullscreen]=useState(false),[changing,setChanging]=useState(false),pending=useRef(false);
 useEffect(()=>{const sync=()=>setFullscreen(!!document.fullscreenElement);sync();document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);},[]);
 async function toggleFullscreen(){
  if(pending.current)return;pending.current=true;setChanging(true);
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{onError('หน้าต่างนี้ไม่รองรับโหมดเต็มจอ ลองใช้ F11 หรือเปิดผ่านเบราว์เซอร์');}
  finally{pending.current=false;setChanging(false);}
 }
 return {fullscreen,changing,toggleFullscreen};
}
export function WorkspacePageNavigation({view,previousView,fullscreen,busy,onBack,onNavigate,onFullscreen,onSidebar,onRefresh,sidebarCollapsed,mobileOpen}:{view:WorkspaceView;previousView?:WorkspaceView;fullscreen:boolean;busy:boolean;onBack:()=>void;onNavigate:(view:WorkspaceView)=>void;onFullscreen:()=>void;onSidebar:()=>void;onRefresh:()=>void;sidebarCollapsed:boolean;mobileOpen:boolean}){
 const [compact,setCompact]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 900px)');
  const sync=()=>setCompact(media.matches);
  sync();media.addEventListener('change',sync);
  return()=>media.removeEventListener('change',sync);
 },[]);
 return <nav className="workspace-page-navigation" aria-label="นำทางระหว่างหน้า">
  {!fullscreen&&<>
   <button type="button" aria-label="ย้อนกลับหน้าก่อนหน้า" title={previousView?'ย้อนกลับ: '+workspaceViewLabels[previousView]:'กลับหน้าหลัก'} disabled={busy||!previousView&&view==='home'} onClick={onBack}><ArrowLeft size={17}/></button>
   <button type="button" aria-label="ไปหน้าหลัก" title="หน้าหลัก" disabled={busy||view==='home'} onClick={()=>onNavigate('home')}><Home size={17}/></button>
  </>}
  <button type="button" className="workspace-sidebar-toggle" aria-label="เปิดเมนู" title={compact?'เปิด/ปิดเมนู':sidebarCollapsed?'ขยายแถบเมนู':'ย่อแถบเมนู'} aria-controls="workspace-navigation" aria-expanded={compact?mobileOpen:!sidebarCollapsed} onClick={onSidebar}>{!compact&&!sidebarCollapsed?<PanelLeftClose size={17}/>:<Menu size={17}/>}</button>
  <button type="button" aria-label={fullscreen?'ออกจากโหมดเต็มจอ':'เปิดโหมดเต็มจอ'} title={fullscreen?'ออกจากเต็มจอ':'เต็มจอ'} disabled={busy} onClick={onFullscreen}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
  <button type="button" className="app-refresh" aria-label="รีเฟรชระบบ" title="รีเฟรชระบบ" disabled={busy} onClick={onRefresh}><RefreshCw size={17}/></button>
 </nav>;
}
