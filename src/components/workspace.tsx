"use client";
import { useCallback,useEffect,useRef,useState,useTransition } from "react";
import dynamic from "next/dynamic";
import {WorkspaceHeading} from "./workspace-ui";
import {WorkspaceNavigation,type WorkspaceView} from "./workspace-navigation";
import { DocumentForm, DocumentFormNav } from "./document-form";
import { ArrowDownToLine,ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle2,ChevronDown,ChevronRight,Cloud,FileText,Files,FolderOpen,History,LayoutDashboard,LoaderCircle,LogOut,Menu,Plus,Printer,RefreshCw,Save,Settings2,ShieldCheck,Sparkles,X } from "lucide-react";
import { documentSchema,newDraft,reviewIssues,statusLabels,thaiDate,documentYear,type Draft,type SavedDraft } from "@/lib/document";
import {fitFloatingImage,sameOverlayContent} from "@/lib/floating-item";
import { documentSample } from "@/lib/document-samples";
import { groups,organizations,template,templates,type DocumentType } from "@/lib/templates";
import type { DocumentAssets } from "@/lib/render-document";
import { saveDocument,deleteDocument,duplicateDocument,getDocuments,getHistory,saveOrganization,uploadDocument,logout } from "@/app/actions";

import { getAppendixImageSources } from "@/app/appendix-actions";
import type { OfficeItem } from "@/lib/office";
import type { Room, Booking } from "@/lib/booking";
import type { CalendarEvent } from "@/lib/calendar";

const AttachmentPreview=dynamic(()=>import("./attachment-editor").then(module=>module.AttachmentPreview));
const LegalReader=dynamic(()=>import("./writing-assistants").then(module=>module.LegalReader));
const DocumentDashboard=dynamic(()=>import("./document-dashboard").then(module=>module.DocumentDashboard));
const ActionSearch=dynamic(()=>import("./action-search").then(module=>module.ActionSearch));
const RecoveryPanel=dynamic(()=>import("./recovery-panel").then(module=>module.RecoveryPanel));
const BudgetTransfers=dynamic(()=>import("./budget-transfers").then(module=>module.BudgetTransfers));
const CorrespondenceRegister=dynamic(()=>import("./correspondence-register").then(module=>module.CorrespondenceRegister));
const OfficeWorkspace=dynamic(()=>import("./office-workspace").then(module=>module.OfficeWorkspace));
const MeetingBookings=dynamic(()=>import("./meeting-bookings").then(module=>module.MeetingBookings));
const WorkCalendar=dynamic(()=>import("./work-calendar").then(module=>module.WorkCalendar));
const LawLibrary=dynamic(()=>import("./law-library").then(module=>module.LawLibrary));
const TemplateReference=dynamic(()=>import("./template-reference").then(module=>module.TemplateReference));
const SetupReadiness=dynamic(()=>import("./setup-readiness").then(module=>module.SetupReadiness));
const StorageSettings=dynamic(()=>import("./system-center").then(module=>module.StorageSettings));
const ReportsDashboard=dynamic(()=>import("./system-center").then(module=>module.ReportsDashboard));
const TemplateGallery=dynamic(()=>import("./template-gallery").then(module=>module.TemplateGallery));
const WorkspaceGuide=dynamic(()=>import("./workspace-guide").then(module=>module.WorkspaceGuide));

import {getOrganizationDirectory} from '@/app/organization-directory-actions';
import type {DirectoryOrganization} from '@/lib/organization-directory';
const OrganizationDirectoryManager=dynamic(()=>import('./organization-directory-manager').then(m=>m.OrganizationDirectoryManager));
type Organization=typeof organizations[number];
type View=WorkspaceView;
type Props={initialDirectory:DirectoryOrganization[];initialCalendar:CalendarEvent[];initialBookings:{rooms:Room[];bookings:Booking[]};initialOffice:OfficeItem[];initialDocuments:SavedDraft[];assets:DocumentAssets;drive:{configured:boolean;connected:boolean;email:string};local:boolean;initialView?:string;googleResult?:string;savedOrganization:Organization|null};
export function Workspace({initialDirectory,initialCalendar,initialBookings,initialOffice,initialDocuments,assets,drive,local,initialView,googleResult,savedOrganization}:Props){
  const [view,setView]=useState<View>(initialView==="register"?"register":initialView==="budget"?"budget":initialView==="reports"?"reports":initialView==="laws"?"laws":initialView==="calendar"?"calendar":initialView==="bookings"?"bookings":initialView==="office"?"office":initialView==="settings"?"settings":"dashboard"),[documents,setDocuments]=useState(initialDocuments);
  const [draft,setDraft]=useState<Draft>(newDraft()),[saved,setSaved]=useState<SavedDraft|null>(null),[baseline,setBaseline]=useState(JSON.stringify(newDraft()));
  const [toast,setToast]=useState<{text:string;error?:boolean}|null>(null),[pending,startTransition]=useTransition(),[mobileNav,setMobileNav]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [focusWriting,setFocusWriting]=useState(false);
  const [overlayTool,setOverlayTool]=useState<{id:string|null;placing:boolean}>({id:null,placing:false});
  const overlayToolRef=useRef(overlayTool);
  function setOverlayMode(id:string|null,placing=false){const tool={id,placing};overlayToolRef.current=tool;setOverlayTool(tool);frame.current?.contentWindow?.postMessage({source:"sarabun-overlay-tool",...tool},"*")}
  function placeSignature(id:string){setFocusWriting(false);setOverlayMode(id,true);requestAnimationFrame(()=>document.querySelector(".preview-pane")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"nearest"}))}

  useEffect(()=>{try{setSidebarCollapsed(localStorage.getItem("sarabun:sidebar-collapsed")==="true")}catch{}},[]);
  const closeMobileNav=useCallback(()=>setMobileNav(false),[]);
  function toggleSidebar(){setSidebarCollapsed(value=>{const next=!value;try{localStorage.setItem("sarabun:sidebar-collapsed",String(next))}catch{}return next})}
  const [attachmentBusy,setAttachmentBusy]=useState(false);
  const busyRef=useRef(false);busyRef.current=pending||attachmentBusy;
  const [missingOverlayPages,setMissingOverlayPages]=useState<number[]>([]);
  const [appendixSources,setAppendixSources]=useState<Record<string,string>>({});
  const [budgetDirty,setBudgetDirty]=useState(false);
  const [registerDirty,setRegisterDirty]=useState(false),[registerBusy,setRegisterBusy]=useState(false);
  const [recoveryKey,setRecoveryKey]=useState(0);
  const [zoom,setZoom]=useState(65),[pages,setPages]=useState(1),[previewHeight,setPreviewHeight]=useState(1123),[overflow,setOverflow]=useState(false),[ready,setReady]=useState(false),[previewError,setPreviewError]=useState(false),[frameKey,setFrameKey]=useState(0),[compactSignoff,setCompactSignoff]=useState(false);
  const [directory,setDirectory]=useState(initialDirectory),[directoryOpen,setDirectoryOpen]=useState(false),[directoryDirty,setDirectoryDirty]=useState(false),[directoryBusy,setDirectoryBusy]=useState(false);
  const directoryDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(!directoryOpen)return;const previous=document.activeElement as HTMLElement|null;const dialog=directoryDialog.current;dialog?.showModal();return()=>{dialog?.close();previous?.focus();};},[directoryOpen]);
  useEffect(()=>{let live=true;const refresh=()=>{getOrganizationDirectory().then(rows=>{if(live)setDirectory(rows);}).catch(()=>{});};window.addEventListener('focus',refresh);return()=>{live=false;window.removeEventListener('focus',refresh);};},[]);
  function closeDirectory(){if(directoryBusy)return;if(directoryDirty&&!confirm('มีรายชื่อหน่วยงานที่ยังไม่บันทึก ต้องการปิดโดยละทิ้งการแก้ไขหรือไม่?'))return;setDirectoryOpen(false);}
  const [organization,setOrganization]=useState<Organization>(savedOrganization||{name:"",department:"",address:"",phone:"",prefix:""});
  const [history,setHistory]=useState<{action:string;version:number;at:string}[]|null>(null),[sample,setSample]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null),imageLoadRevision=useRef(0),previewRetries=useRef(0); const dirty=JSON.stringify(draft)!==baseline;
  const issues=reviewIssues(draft);
  const [previewDraft,setPreviewDraft]=useState(draft),[html,setHtml]=useState("");
  useEffect(()=>{
    const localPages=draft.copyMark==="สำเนาคู่ฉบับ"?Math.max(1,Math.floor(pages/2)):pages;
    if(ready&&sameOverlayContent(draft,previewDraft)&&[...draft.floatingItems,...previewDraft.floatingItems].every(item=>item.page<=localPages)){
      frame.current?.contentWindow?.postMessage({source:"sarabun-overlay-sync",items:draft.floatingItems.map(({id,page,xMm,yMm,widthMm})=>({id,page,xMm,yMm,widthMm}))},"*");return;
    }
    setReady(false);setPreviewError(false);previewRetries.current=0;const timer=setTimeout(()=>setPreviewDraft(draft),300);return()=>clearTimeout(timer);
  },[draft]);
  useEffect(()=>{
    if(view!=="editor"){setHtml("");return;}
    let active=true;
    import("@/lib/render-document").then(({documentHtml})=>{
      if(active){setReady(false);setPreviewError(false);setHtml(documentHtml(previewDraft,assets,appendixSources));setFrameKey(key=>key+1);}
    }).catch(()=>{
      if(active){setPreviewError(true);setToast({text:"สร้างตัวอย่างเอกสารไม่สำเร็จ กรุณากดโหลดตัวอย่างใหม่",error:true});}
    });
    return()=>{active=false;};
  },[view,previewDraft,assets,appendixSources]);
  useEffect(()=>{const handle=(event:MessageEvent)=>{
    if(event.source!==frame.current?.contentWindow)return;
    const message=event.data;
    if(message?.source==="sarabun-overlay-cancel"){setOverlayMode(null);return}
    if(message?.source==="sarabun-overlay-select"){if(typeof message.id==="string")setOverlayMode(message.id);return}
    if(message?.source==="sarabun-overlay-position"){
      if(busyRef.current)return;
      const {id,xMm,yMm,widthMm,page}=message;
      if(typeof id!=="string"||![xMm,yMm,widthMm,page].every(Number.isFinite)||!Number.isInteger(page)||page<1||page>100)return;
      setOverlayMode(id);
      setDraft(d=>{
        let changed=false;
        const floatingItems=d.floatingItems.map(item=>{
          if(item.id!==id)return item;
          const next=item.kind==="image"?fitFloatingImage(item,{xMm,yMm,widthMm,page}):{...item,xMm:Math.max(0,Math.min(195,xMm)),yMm:Math.max(0,Math.min(285,yMm)),page};
          if(next.xMm!==item.xMm||next.yMm!==item.yMm||next.widthMm!==item.widthMm||next.page!==item.page)changed=true;
          return next;
        });
        return changed?{...d,status:"draft",floatingItems}:d;
      });return;
    }
    if(message?.source!=="sarabun-preview")return;
    const valid=!message.error&&Number(message.pages)>0;
    if(valid){setPages(message.pages);setPreviewHeight(message.height||1123);setOverflow(!!message.overflow);setMissingOverlayPages(Array.isArray(message.missingOverlayPages)?message.missingOverlayPages:[]);setCompactSignoff(!!message.compactSignoff);}
    setPreviewError(!valid);setReady(valid);
  };window.addEventListener("message",handle);return()=>window.removeEventListener("message",handle)},[]);
  useEffect(()=>{if(ready){frame.current?.contentWindow?.postMessage({source:"sarabun-overlay-sync",items:draft.floatingItems.map(({id,page,xMm,yMm,widthMm})=>({id,page,xMm,yMm,widthMm}))},"*");frame.current?.contentWindow?.postMessage({source:"sarabun-overlay-tool",...overlayToolRef.current},"*")}},[ready,frameKey]);
  useEffect(()=>{setOverlayMode(null)},[view,saved?.id,draft.type]);
  useEffect(()=>{if(overlayToolRef.current.id&&!draft.floatingItems.some(item=>item.id===overlayToolRef.current.id))setOverlayMode(null)},[draft.floatingItems]);
  useEffect(()=>{if(!overlayTool.placing)return;const cancel=(event:KeyboardEvent)=>{if(event.key==="Escape")setOverlayMode(null)};window.addEventListener("keydown",cancel);return()=>window.removeEventListener("keydown",cancel)},[overlayTool.placing]);

  useEffect(()=>{if(view!=="editor"||!html||ready)return;const timer=setTimeout(()=>{if(previewRetries.current<2){previewRetries.current++;setPreviewError(false);setFrameKey(key=>key+1)}else setPreviewError(true)},previewError?1000:15000);return()=>clearTimeout(timer)},[view,html,ready,frameKey,previewError]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),6500);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{const prevent=(e:BeforeUnloadEvent)=>{if(dirty||budgetDirty||registerDirty||registerBusy||directoryDirty||directoryBusy){e.preventDefault();e.returnValue=""}};window.addEventListener("beforeunload",prevent);return()=>window.removeEventListener("beforeunload",prevent)},[dirty,budgetDirty,registerDirty,registerBusy,directoryDirty,directoryBusy]);
  useEffect(()=>{if(googleResult)setToast({text:googleResult==="connected"?"เชื่อมต่อ Google Drive เรียบร้อยแล้ว":googleResult==="setup"?"กรุณาตั้งค่า Google OAuth และ SESSION_SECRET ตามคู่มือ": "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่และตรวจ Redirect URI",error:googleResult!=="connected"})},[googleResult]);
  function refreshPreview(){setReady(false);setPreviewError(false);setOverflow(false);previewRetries.current=0;setPreviewDraft({...draft});void loadAppendixSources(draft)}
  function busyNavigation(){if(!busyRef.current&&!registerBusy&&!directoryBusy){return directoryDirty&&!confirm("มีรายชื่อหน่วยงานที่ยังไม่บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?");}setToast({text:"กำลังบันทึกหรือประมวลผลเอกสาร กรุณารอให้เสร็จก่อนเปลี่ยนหน้า"});return true}
  function navigate(next:View){if(busyNavigation())return;if(view==="register"&&registerDirty&&!confirm("มีทะเบียนที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?"))return;if(view==="budget"&&budgetDirty&&!confirm("มีคำขอโอนงบที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?"))return;if(view==="editor"&&dirty&&!confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?"))return;setView(next);setMobileNav(false);setHistory(null)}
  function update<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(d=>({...d,[key]:value,...(["body","bodyMode","background","legalBasis","facts","consideration","proposal"].includes(key)?{contentBlocks:[]}:{}),...(key!=="status"?{status:"draft" as const}:{})}))}
  async function loadAppendixSources(value:Draft){const revision=++imageLoadRevision.current;setAppendixSources({});const ids=[...new Set([...value.appendixImages.map(image=>image.id),...value.floatingItems.filter(item=>item.kind==="image").map(item=>item.image.id)])];if(!ids.length)return;try{const sources=await getAppendixImageSources(ids);if(revision===imageLoadRevision.current)setAppendixSources(sources)}catch(error){if(revision!==imageLoadRevision.current)return;setAppendixSources({});setToast({text:error instanceof Error?error.message:"โหลดภาพแนบท้ายไม่สำเร็จ",error:true})}}
  function openDraft(d:SavedDraft){if(busyNavigation())return;applyDraft(d)}
  function applyDraft(d:SavedDraft){if(view==="editor"&&dirty&&!confirm("ละทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่?"))return;setRecoveryKey(n=>n+1);const value=documentSchema.parse(d);setDraft(value);setPreviewDraft(value);void loadAppendixSources(value);setSaved(d);setBaseline(JSON.stringify(value));setSample(false);setHistory(null);setView("editor");setMobileNav(false);setReady(false)}
  function create(type:DocumentType){if(busyNavigation())return;if(view==="register"&&registerDirty&&!confirm("มีทะเบียนที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?"))return;if(view==="editor"&&dirty&&!confirm("ละทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่?"))return;setRecoveryKey(n=>n+1);const value={...newDraft(type),organization:organization.name,department:organization.department,address:organization.address,phone:organization.phone};setDraft(value);setPreviewDraft(value);imageLoadRevision.current++;setAppendixSources({});setSaved(null);setBaseline(JSON.stringify(value));setSample(false);setView("editor");setReady(false);setHistory(null)}
  async function persist(){if(attachmentBusy)throw new Error("กรุณารออัปโหลดไฟล์แนบให้เสร็จ");const submitted=JSON.stringify(draft);const result=await saveDocument(draft,saved?.id,saved?.version);if(!result.ok){setToast({text:result.error,error:true});return null}const canonical=documentSchema.parse(result.data);setSaved(result.data);setBaseline(JSON.stringify(canonical));setDraft(current=>JSON.stringify(current)===submitted?canonical:current);setDocuments(await getDocuments());return result.data}
  function save(){startTransition(async()=>{try{const result=await persist();if(result)setToast({text:"บันทึกร่างเรียบร้อยแล้ว"})}catch{setToast({text:"ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองบันทึกใหม่",error:true})}})}
  function loadSample(){if((saved||dirty)&&!confirm("แทนข้อมูลในแบบฟอร์มด้วยตัวอย่างหรือไม่? เลขทะเบียนและไฟล์แนบเดิมจะยังอยู่"))return;setDraft(documentSample);setSample(true)}
  const [exporting,setExporting]=useState<'pdf'|'word'|null>(null);
  async function exportDocument(format:'pdf'|'word'){
    setExporting(format);
    try {
      const result=dirty||!saved?await persist():saved;if(!result)return;
      const response=await fetch(`/api/documents/${result.id}/${format}`);
      if(!response.ok){const body=await response.json();throw new Error(body.error||"ส่งออกไม่สำเร็จ")}
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=result.subject+(format==='word'?'.docx':'.pdf');a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
      setToast({text:format==='word'?"ดาวน์โหลด Word แล้ว · ตรวจการจัดหน้าหลังแก้ไขก่อนพิมพ์":"ดาวน์โหลด PDF เรียบร้อยแล้ว"});
    } finally {setExporting(null)}
  }
  const exportPdf=()=>exportDocument('pdf'),exportWord=()=>exportDocument('word');
  function asyncJob(job:()=>Promise<void>){startTransition(async()=>{try{await job()}catch(e){setToast({text:e instanceof Error?e.message:"ดำเนินการไม่สำเร็จ",error:true})}})}
  return <div className={`app-shell ${sidebarCollapsed?"sidebar-collapsed":""}`}>
    <a className="skip-link" href="#workspace-content">ข้ามไปยังเนื้อหา</a>
    {directoryOpen&&<dialog ref={directoryDialog} className="organization-directory-dialog" aria-label="จัดการรายชื่อหน่วยงาน" onCancel={e=>{e.preventDefault();closeDirectory();}}><div className="directory-dialog-close"><button type="button" disabled={directoryBusy} onClick={closeDirectory}><X size={16}/>ปิดรายชื่อหน่วยงาน</button></div><OrganizationDirectoryManager entries={directory} onChange={setDirectory} onDirty={setDirectoryDirty} onBusy={setDirectoryBusy}/></dialog>}
    <WorkspaceNavigation view={view} count={documents.length} connected={drive.connected} local={local} organization={organization.name} collapsed={sidebarCollapsed} mobileOpen={mobileNav} onToggle={toggleSidebar} onClose={closeMobileNav} onNavigate={navigate} onLogout={()=>{if(!busyNavigation())asyncJob(async()=>{await logout()})}}/>
    <div className="main-shell" id="workspace-content" tabIndex={-1}><header className="topbar"><div className="breadcrumbs"><button className="mobile-menu" aria-label="เปิดเมนู" aria-controls="workspace-navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}><Menu size={20}/></button><span>พื้นที่ทำงาน</span><ChevronRight size={14}/><strong>{{register:"ทะเบียนรับ–ส่งหนังสือ",budget:"โอนงบประมาณ",reports:"ภาพรวมและรายงานระบบ",laws:"คลังกฎหมายและระเบียบ",calendar:"ปฏิทินงาน",bookings:"จองห้องประชุม",office:"งานธุรการเทศบาล",dashboard:"แดชบอร์ดเอกสาร",templates:"แบบหนังสือราชการ",editor:"จัดทำร่างหนังสือ",settings:"ตั้งค่าระบบ",guide:"คู่มือและแหล่งอ้างอิง"}[view]}</strong></div><ActionSearch onChoose={action=>{if(action.documentType){if(view==="budget"&&budgetDirty&&!confirm("มีคำขอโอนงบที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?"))return;create(action.documentType);}else navigate(action.view);}}/><button type="button" className="app-refresh" disabled={pending||attachmentBusy||registerBusy||directoryBusy} aria-label="รีเฟรชระบบ" title="รีเฟรชระบบ" onClick={()=>window.location.reload()}><RefreshCw size={17}/><span>รีเฟรช</span></button><div className="topbar-right"><span className="top-date">{thaiDate(newDraft().date)}</span></div></header>
    {(view==="editor"||view==="dashboard")&&<RecoveryPanel scope="document" value={draft} enabled={view==="editor"&&dirty&&!attachmentBusy&&!pending} contextKey={(saved?.id||('new-'+draft.type))+'-'+recoveryKey} onRestore={value=>{if(busyNavigation())return;setRecoveryKey(n=>n+1);const recovered={...documentSchema.parse(value),status:"draft" as const};setDraft(recovered);void loadAppendixSources(recovered);setSaved(null);setBaseline('');setPreviewDraft(recovered);setView("editor");setSample(false);}}/>}
    {view==="budget"&&<BudgetTransfers assets={assets} onDirtyChange={setBudgetDirty} onOpenDocument={d=>{setDocuments(list=>[d,...list.filter(x=>x.id!==d.id)]);openDraft(d);}}/>}
    {view==="reports"&&<ReportsDashboard/>}
    {view==="laws"&&<LawLibrary connected={drive.connected}/>}
    {view==="calendar"&&<WorkCalendar initial={initialCalendar} office={initialOffice} documents={documents} bookings={initialBookings.bookings} onOpenDocument={openDraft}/>}
    {view==="bookings"&&<MeetingBookings initial={initialBookings} documents={documents} onOpenDocument={openDraft}/>}
    {view==="register"&&<CorrespondenceRegister department={organization.department||organization.name} documents={documents} onOpenDocument={openDraft} onDirty={setRegisterDirty} onBusy={setRegisterBusy}/>}
    {view==="office"&&<OfficeWorkspace initialItems={initialOffice} documents={documents} onOpenDocument={openDraft}/>}
    {view==="dashboard"&&<DocumentDashboard
      documents={documents}
      pending={pending}
      onOpen={openDraft}
      onCreate={create}
      onOpenTemplates={()=>navigate("templates")}
      onRefresh={()=>asyncJob(async()=>{setDocuments(await getDocuments());setToast({text:"อัปเดตรายการแล้ว"})})}
      onDuplicate={d=>asyncJob(async()=>{const copy=await duplicateDocument(d.id);setDocuments(await getDocuments());applyDraft(copy);setToast({text:"สร้างสำเนาร่างแล้ว"})})}
      onDelete={d=>{if(confirm(`ย้าย “${d.subject}” ไปถังขยะหรือไม่? กู้คืนพร้อมไฟล์สแกนและเอกสารแนบได้`))asyncJob(async()=>{const result=await deleteDocument(d.id,d.version);if(!result.ok)throw new Error(result.error);setDocuments(await getDocuments());setToast({text:"ย้ายเข้าถังขยะแล้ว สามารถกู้คืนได้ด้านล่างรายการเอกสาร"})})}}
    />}
    {view==="templates"&&<TemplateGallery onCreate={create}/>}
    {view==="editor"&&<main className={`editor-main ${focusWriting?"editor-focus":""}`}><div className="editor-header"><div className="editor-title"><button className="icon-button" aria-label="กลับรายการ" disabled={pending||attachmentBusy} onClick={()=>navigate("dashboard")}><ArrowLeft size={19}/></button><div><div className="eyebrow">{template(draft.type).name}</div><h1>{saved?"แก้ไขร่างหนังสือ":"จัดทำร่างหนังสือใหม่"}</h1></div><span className="badge draft">{dirty?"ยังไม่ได้บันทึก":saved?"บันทึกแล้ว":"ฉบับร่าง"}</span></div><div className="editor-actions"><button className="secondary" title="แก้ไขข้อความและตารางต่อใน Word · ไฟล์ PDF แนบจะเป็นภาพแต่ละหน้า" disabled={pending||overflow||missingOverlayPages.length>0||!ready||attachmentBusy} onClick={()=>asyncJob(exportWord)}><FileText size={17}/><span>{exporting==='word'?'กำลังสร้าง Word…':'ดาวน์โหลด Word'}</span></button><button className="secondary" disabled={pending||overflow||missingOverlayPages.length>0||!ready||attachmentBusy} onClick={()=>asyncJob(exportPdf)}><ArrowDownToLine size={17}/><span>ดาวน์โหลด PDF</span></button><button className="primary" disabled={pending||attachmentBusy} onClick={save}>{pending?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>}บันทึกร่าง</button></div></div>
      <div className="editor-view-controls"><span>พื้นที่ร่างหนังสือ</span><button type="button" aria-pressed={focusWriting} onClick={()=>setFocusWriting(value=>!value)}><FileText size={15}/>{focusWriting?"แสดงตัวอย่างคู่กัน":"โฟกัสการเขียน"}</button></div><div className="editor-layout"><div className="form-pane"><div className="form-intro"><div><h2>ร่างหนังสือ</h2><p>กรอกตามลำดับ หรือข้ามไปส่วนที่ต้องการ</p></div><button className="text-button" onClick={loadSample} disabled={pending||attachmentBusy}><Sparkles size={15}/>ใช้ข้อมูลตัวอย่าง</button></div>{sample&&<div className="sample-notice">ข้อมูลสาธิต กรุณาเปลี่ยนเป็นข้อมูลจริงก่อนนำไปใช้งาน</div>}
      <DocumentFormNav external={draft.type==="external"}/><fieldset disabled={pending||attachmentBusy} className="editor-fields">
      <DocumentForm directory={directory} onManageOrganizations={()=>setDirectoryOpen(true)} onPlaceSignature={placeSignature} key={saved?.id||draft.type} draft={draft} organization={organization} sources={appendixSources} onSources={setAppendixSources} pages={pages} onBusy={setAttachmentBusy} onChange={patch=>setDraft(d=>({...d,...patch,...(Object.keys(patch).some(key=>["body","bodyMode","background","facts","legalBasis","consideration","proposal","sectionHeadings","minutesMode","meetingAgenda","minutesIntroduction"].includes(key))?{contentBlocks:[]}:{}),status:"draft"}))}/><div id="form-review" className="review-card"><div className="section-title"><h3><ShieldCheck size={19}/>ตรวจทานก่อนส่งออก</h3><span className={`badge ${issues.length?"draft":"success"}`}>{issues.length?`${issues.length} จุดที่ต้องเติม`:"ข้อมูลหลักครบ"}</span></div>{issues.length?<details className="review-issues"><summary>ดูข้อมูลที่ยังต้องเติม {issues.length} จุด</summary><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></details>:<p className="review-pass"><CheckCircle2 size={16}/>กรอกข้อมูลหลักครบแล้ว โปรดตรวจเนื้อหาและอำนาจผู้ลงนาม</p>}{draft.type==="other"&&<p className="error-text">หนังสืออื่นไม่มีแบบตายตัว ต้องปรับให้ตรงกับหลักฐานเฉพาะงาน</p>}{draft.confidentiality!=="ปกติ"&&<p className="error-text">รุ่นนี้ไม่รองรับการอัปโหลดหนังสือลับขึ้น Drive</p>}<label className="check-label"><input type="checkbox" checked={draft.status==="reviewed"} disabled={issues.length>0} onChange={e=>update("status",e.target.checked?"reviewed":"draft")}/><span>ฉันได้ตรวจเนื้อหา รูปแบบ ผู้รับ และอำนาจผู้ลงนามแล้ว</span></label><p className="field-note">รายการนี้ช่วยตรวจข้อมูลเบื้องต้น ไม่ใช่การรับรองความถูกต้องตามระเบียบทุกกรณี</p></div>
      <details className="storage-card"><summary className="section-title"><h3><Cloud size={19}/>จัดเก็บ Google Drive</h3><span className={`badge ${drive.connected?"success":"neutral"}`}>{drive.connected?"เชื่อมต่อแล้ว":"รอเชื่อมต่อ"}</span></summary><label>จัดกลุ่มปีตาม<select value={draft.yearMode} onChange={e=>update("yearMode",e.target.value as Draft["yearMode"])}><option value="fiscal">ปีงบประมาณ (1 ต.ค. – 30 ก.ย.)</option><option value="calendar">ปีปฏิทิน (1 ม.ค. – 31 ธ.ค.)</option></select></label><div className="folder-path"><FolderOpen size={15}/>สารบรรณ / {template(draft.type).name} / {draft.date?`${draft.yearMode==="fiscal"?"ปีงบประมาณ":"ปีปฏิทิน"} ${documentYear(draft.date,draft.yearMode)}`:"ยังไม่ระบุปี"}</div><button className="secondary full-width" disabled={attachmentBusy||pending||!drive.connected||draft.status!=="reviewed"||overflow||missingOverlayPages.length>0||!ready||draft.confidentiality!=="ปกติ"} onClick={()=>asyncJob(async()=>{const current=dirty||!saved?await persist():saved;if(!current)return;const result=await uploadDocument(current.id,current.version);if(!result.ok)throw new Error(result.error);const list=await getDocuments();setDocuments(list);setSaved(list.find(d=>d.id===current.id)||current);setToast({text:"จัดเก็บ PDF บน Google Drive แล้ว"})})}><Cloud size={17}/>บันทึก PDF ไปยัง Drive</button>{saved?.driveFileId&&<a className="text-link" target="_blank" rel="noreferrer" href={`https://drive.google.com/file/d/${saved.driveFileId}/view`}>เปิดไฟล์บน Drive{saved.syncedVersion!==saved.version?" (มีการแก้ไขใหม่ที่ยังไม่ได้ซิงก์)":""}<ArrowRight size={14}/></a>}</details></fieldset>{saved&&<button className="history-button" onClick={()=>asyncJob(async()=>setHistory(await getHistory(saved.id)))}><History size={16}/>ดูประวัติการดำเนินการ</button>}{history&&<div className="history-panel"><h3>ประวัติร่างหนังสือ</h3>{history.map((h,i)=><p key={i}><span>{{create:"สร้างร่าง",update:"แก้ไขร่าง",drive_upload:"อัปโหลด Drive",delete:"ลบร่าง"}[h.action]||h.action} · ฉบับ {h.version}</span><small>{new Date(h.at).toLocaleString("th-TH")}</small></p>)}</div>}
      </div><div className="preview-pane" aria-hidden={focusWriting} inert={focusWriting}><LegalReader/><div className="preview-toolbar"><div><span className="live-dot"/><strong>ตัวอย่างหนังสือ</strong></div><div><select aria-label="ขนาดตัวอย่าง" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[50,65,75,100].map(n=><option key={n} value={n}>{n}%</option>)}</select><button type="button" aria-label="โหลดตัวอย่างใหม่" title="โหลดตัวอย่างใหม่โดยไม่ลบข้อความ" onClick={refreshPreview}><RefreshCw size={18}/></button><button aria-label="พิมพ์เอกสาร" title="พิมพ์เอกสาร" disabled={!ready||overflow||missingOverlayPages.length>0||pending||attachmentBusy} onClick={()=>{if(dirty&&!confirm("พิมพ์ตัวอย่างที่ยังไม่ได้บันทึกหรือไม่?"))return;if(draft.attachmentFiles.length){asyncJob(exportPdf);return;}frame.current?.contentWindow?.postMessage("sarabun-print","*")}}><Printer size={18}/></button></div></div>
      {overlayTool.placing&&<div className="signature-placement" role="status"><span>คลิกจุดกึ่งกลางที่ต้องการวางลายเซ็นบนกระดาษ</span><button type="button" onClick={()=>setOverlayMode(null)}>ยกเลิกการวาง</button></div>}
      <div className="preview-info"><span>A4 · 210 × 297 มม.</span><span>TH Sarabun New · 16 pt</span></div>{previewError&&<div className="overflow-alert" role="alert">ตัวอย่างเอกสารยังโหลดไม่สำเร็จ กด “โหลดตัวอย่างใหม่” ด้านบนเพื่อสร้างอีกครั้งโดยไม่ลบข้อความ</div>}{overflow&&<div className="overflow-alert" role="alert">ส่วนหัวหรือองค์ประกอบยาวเกินหน้า กรุณาลดหรือแบ่งข้อความก่อนส่งออก</div>}{missingOverlayPages.length>0&&<div className="overflow-alert missing-overlay-alert" role="alert">มีข้อความหรือภาพวางอิสระอยู่บนหน้าที่ไม่มีแล้ว (หน้า {missingOverlayPages.join(", ")}) กรุณาเลือกหน้าใหม่ในส่วนลายเซ็นหรือข้อความและภาพอิสระก่อนส่งออก</div>}<div className="paper-scroll" inert={pending||attachmentBusy}><div className="paper-scale" style={{width:794*zoom/100,height:previewHeight*zoom/100}}><iframe key={frameKey} ref={frame} title="ตัวอย่างหนังสือ A4" sandbox="allow-scripts allow-modals" srcDoc={html} style={{width:794,height:previewHeight,transform:`scale(${zoom/100})`}}/></div><AttachmentPreview files={draft.attachmentFiles}/></div><div className="preview-footer"><ShieldCheck size={14}/><span>{ready?`${compactSignoff?"จัดช่องไฟกระชับเพื่อพยายามคงส่วนลงนามไว้หน้าแรก · ":""}ตัวอย่าง ${pages} หน้า${draft.appendixPages.length?` · เอกสารแนบท้ายที่สร้างเอง ${draft.appendixPages.length} ฉบับ`:""}${draft.appendixImages.length?` · ภาคผนวกภาพ ${Math.ceil(draft.appendixImages.length/2)} หน้า`:""}${draft.attachmentFiles.length?` · เอกสารแนบ ${draft.attachmentFiles.reduce((n,a)=>n+a.pages,0)} หน้า`:""} · ตรวจรูปแบบก่อนพิมพ์`:"กำลังจัดหน้า…"}</span></div></div></div>
    </main>}
    {view==="settings"&&<main className="page-main settings-main workspace-page"><WorkspaceHeading icon={Settings2} title="ตั้งค่าหน่วยงานและ Drive" description="ข้อมูลหน่วยงาน การเชื่อมต่อ และสำรองข้อมูล"/><div className="settings-grid"><section className="panel settings-card"><div className="section-title"><h2><Settings2 size={21}/>หน่วยงานหลักสำหรับร่างใหม่</h2></div><div className="field-grid">{([['name','ชื่อส่วนราชการ'],['department','หน่วยงานเจ้าของเรื่อง'],['address','ที่อยู่'],['phone','โทรศัพท์'],['prefix','รหัสหน่วยงานสำหรับอ้างอิงเลขที่']] as const).map(([key,label])=><label className={key==="address"||key==="name"?"wide":""} key={key}>{label}<input value={organization[key]} onChange={e=>setOrganization(o=>({...o,[key]:e.target.value}))}/></label>)}</div><button className="primary" disabled={pending||!organization.name.trim()} onClick={()=>asyncJob(async()=>{await saveOrganization(organization);setToast({text:"บันทึกข้อมูลหน่วยงานแล้ว"})})}><Save size={16}/>บันทึกข้อมูลหน่วยงาน</button><p className="field-note">ใช้เป็นค่าเริ่มต้นเมื่อสร้างร่างใหม่ ส่วนรายการในช่องกรอกอัตโนมัติจัดการได้ด้านล่าง เลขหนังสือให้ใช้จากทะเบียนจริง</p></section><section className="panel settings-card"><div className="section-title"><h2><Cloud size={22}/>Google Drive</h2><span className={`badge ${drive.connected?"success":"neutral"}`}>{drive.connected?"เชื่อมต่อแล้ว":"ยังไม่ได้เชื่อมต่อ"}</span></div><p>{drive.connected?drive.email:"เชื่อมต่อบัญชีหน่วยงานเพื่อจัดเก็บ PDF เป็นหมวดหมู่"}</p><details className="drive-explanation"><summary>ดูรูปแบบการจัดเก็บและสิทธิ์ไฟล์</summary><div className="drive-folder-demo"><FolderOpen size={18}/>สารบรรณ<div><FolderOpen size={17}/>หนังสือภายนอก<div><FolderOpen size={16}/>ปีงบประมาณ 2569<div><FileText size={15}/>เลขที่_ชื่อเรื่อง.pdf</div></div></div></div><div className="connection-notes"><p><CheckCircle2 size={16}/>ขอสิทธิ์เฉพาะไฟล์ที่แอปสร้างหรือเปิดใช้งาน</p><p><CheckCircle2 size={16}/>จัดเก็บตามวันที่หนังสือและรูปแบบปีที่เลือก</p><p><CheckCircle2 size={16}/>อัปโหลดฉบับแก้ไขโดยใช้ไฟล์เดิม</p></div></details>{drive.configured?<a className="primary" href="/api/google/connect"><Cloud size={17}/>{drive.connected?"เชื่อมต่อบัญชีอีกครั้ง":"เชื่อมต่อ Google Drive"}<ArrowRight size={17}/></a>:<div className="setup-note"><strong>ตั้งค่าการเชื่อมต่อครั้งแรก</strong><details><summary>วิธีตั้งค่า Google Drive</summary><p>เพิ่ม GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL และ SESSION_SECRET ใน .env.local แล้วเริ่มเซิร์ฟเวอร์ใหม่</p><code>Redirect URI: /api/google/callback</code><p>ขั้นตอนทั้งหมดอยู่ใน README.md ของโปรเจกต์</p></details></div>}<small>ระบบไม่เพิ่มสิทธิ์แชร์ แต่ไฟล์สืบทอดสิทธิ์โฟลเดอร์ปลายทาง กรุณาตรวจสิทธิ์ก่อนจัดเก็บ</small></section></div><section className="panel settings-card organization-directory-card"><OrganizationDirectoryManager entries={directory} onChange={setDirectory} onDirty={setDirectoryDirty} onBusy={setDirectoryBusy}/></section><details className="settings-disclosure"><summary><FolderOpen size={19}/><span><strong>พื้นที่จัดเก็บและสำรองข้อมูล</strong><small>โฟลเดอร์ในเครื่อง · ส่งออก · ซิงก์และกู้คืน</small></span><ChevronDown size={17}/></summary><StorageSettings/></details><SetupReadiness/></main>}
    {view==="guide"&&<WorkspaceGuide/>}
    </div>{toast&&<div role={toast.error?"alert":"status"} className={`toast ${toast.error?"toast-error":""}`}>{toast.error?<X size={19}/>:<CheckCircle2 size={19}/>}<span>{toast.text}</span><button aria-label="ปิดข้อความ" onClick={()=>setToast(null)}><X size={15}/></button></div>}
  </div>;
}
