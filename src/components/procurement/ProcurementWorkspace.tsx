'use client';
import {useEffect,useRef,useState} from 'react';
import type {SavedDraft} from '@/lib/document';
import {CoreDraftBridge} from './CoreDraftBridge';
import {useCoreDrafts} from './hooks/useCoreDrafts';

import {buildBinderManifest} from '@/lib/procurement/manifest';
import {getProcurementTerms} from '@/lib/procurement/calculations';
import {ProcurementCaseInputSchema} from '@/lib/procurement/schema';
import {procurementRepository} from '@/lib/procurement/storage/repository';
import {cleanForExport,cloneCaseSafely,newCase,PdfDefaultsSchema,TIMELINE,type ExternalDocSlot,type ExternalFile,type RegistryEntry,type StoredCase} from '@/lib/procurement/workspace/model';
import {sampleCase,sampleHireCase} from '@/lib/procurement/workspace/samples';
import type {ValidationIssue} from '@/lib/procurement/types';

import type {PdfBinderOptions} from '@/lib/procurement/exporters/profiles';
import {useProcurementCase} from './hooks/useProcurementCase';
import {ProcurementCaseList} from './ProcurementCaseList';
import {TopCommandBar} from './TopCommandBar';
import {JobBudgetSection} from './sections/JobBudgetSection';
import {ItemsVendorSection} from './sections/ItemsVendorSection';
import {InspectorsSignatoriesSection} from './sections/InspectorsSignatoriesSection';
import {TimelineNumberingSection} from './sections/TimelineNumberingSection';
import {InspectionPhotosSection} from './sections/InspectionPhotosSection';
import {ValidationPanel} from './right-pane/ValidationPanel';
import {BinderNavigator} from './right-pane/BinderNavigator';
import {CoreA4Preview} from './right-pane/CoreA4Preview';
import {ExternalSlotPreview} from './right-pane/ExternalSlotPreview';
import {MasterDataDrawer} from './modals/MasterDataDrawer';
import {BlockingErrorModal} from './modals/BlockingErrorModal';
import {ExportPdfModal} from './modals/ExportPdfModal';
import {formAmounts} from './fields';
import {procurementFetch,procurementJson} from '@/lib/procurement/storage/client-request';
import './workspace.css';
type ExportJob={kind:'pdf';options:PdfBinderOptions}|{kind:'docx';single:boolean};
const sections=[['job','1 งานและงบ'],['items','2 รายการ / ร้านค้า'],['people','3 ผู้ลงนาม'],['timeline','4 เลขที่ / วันที่'],['inspection','5 ตรวจรับ / รูป']] as const;
const sourceLabels:Record<string,string>={VENDOR_EXTERNAL:'ร้านค้า',LAAS_EXTERNAL:'ระบบ e-LAAS',EGP_EXTERNAL:'ระบบ e-GP',OTHER:'หลักฐานเพิ่มเติม'};
export function ProcurementWorkspace({requestedCase,onRequestedCaseHandled,onDirty,onBusy,onArchive,onOpenDocument,onDraftsChanged}:{department:string;requestedCase?:{caseId:string;docId?:string}|null;onRequestedCaseHandled?:()=>void;onDirty:(v:boolean)=>void;onBusy:(v:boolean)=>void;onArchive:()=>void;onOpenDocument?:(draft:SavedDraft)=>boolean|void;onDraftsChanged?:(drafts:SavedDraft[])=>void}){
 const state=useProcurementCase(onDirty,onBusy),{record,update,computed,issues}=state;
 const [tab,setTab]=useState('job'),[selected,setSelected]=useState<ExternalDocSlot>('1'),[masterTab,setMasterTab]=useState<string|null>(null),[pdf,setPdf]=useState(false),[blocking,setBlocking]=useState<ExportJob|null>(null),[exporting,setExporting]=useState(false),[uploading,setUploading]=useState(false),[uploadingSlot,setUploadingSlot]=useState<string|null>(null),[extUploadError,setExtUploadError]=useState(''),[message,setMessage]=useState(''),[registry,setRegistry]=useState<RegistryEntry[]>([]),[commitInput,setCommitInput]=useState<StoredCase['caseInput']|null>(null);
 const [linking,setLinking]=useState(false);
 const core=useCoreDrafts({caseId:record?.caseInput.id,disabled:state.saving||exporting||uploading,flush:state.flush,onBusy:setLinking,onOpenDocument,onDraftsChanged});
 const requestedUrlCase=useRef(false);
 useEffect(()=>{if(!state.ready||!requestedCase)return;let active=true;procurementRepository.getCase(requestedCase.caseId).then(async next=>{if(!active)return;if(!next)throw Error('ไม่พบงานจัดซื้อจัดจ้าง');await open(next,requestedCase.docId);onRequestedCaseHandled?.();}).catch(e=>{if(active){report(e);onRequestedCaseHandled?.();}});return()=>{active=false;};},[state.ready,requestedCase]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!state.ready||requestedUrlCase.current||requestedCase)return;const query=new URLSearchParams(location.search),id=query.get('coreCase');if(!id)return;let active=true;procurementRepository.getCase(id).then(async next=>{if(!active)return;requestedUrlCase.current=true;if(!next)throw Error('ไม่พบงานจัดซื้อจัดจ้าง');await open(next,query.get('doc')||undefined);if(query.get('tab')==='timeline')setTab('timeline');}).catch(e=>{if(active)report(e);});return()=>{active=false;};},[state.ready,requestedCase]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{procurementRepository.getNumberingRegistry().then(setRegistry).catch(e=>state.setError(String(e)));},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{onBusy(state.saving||exporting||uploading||linking);},[onBusy,state.saving,exporting,uploading,linking]);
 useEffect(()=>{if(selected!=='OTHER'&&computed&&!buildBinderManifest(computed).some(r=>r.docId===selected))setSelected('1');},[computed,selected]);
 const total=record?formAmounts(record.caseInput.items,record.caseInput.vendor.isVatRegistered).grandTotal:0;
 useEffect(()=>{if(record&&total>100000&&record.caseInput.inspectorMode!=='COMMITTEE_3')update(n=>{n.caseInput.inspectorMode='COMMITTEE_3';n.caseInput.inspectors=Array.from({length:3},(_,i)=>({...n.caseInput.inspectors[i]??{fullName:'',position:''},role:i===0?'CHAIRPERSON':'MEMBER'}));});},[total,record?.caseInput.inspectorMode]); // eslint-disable-line react-hooks/exhaustive-deps
 const busy=state.saving||exporting||uploading||linking;
 function startNew(type:'BUY'|'HIRE'='BUY'){const next=newCase(state.master.data,type);try{const defaults=PdfDefaultsSchema.safeParse(JSON.parse(localStorage.getItem('sarabun.procurement.pdf-defaults')||'null'));if(defaults.success)next.pdfDefaults=defaults.data;}catch{}return open(next);}
 function report(e:unknown){state.setError(e instanceof Error?e.message:String(e));}
 async function open(next:StoredCase,initialDocId?:string){try{await state.open(next);setSelected((initialDocId as ExternalDocSlot)||'1');setTab('job');setCommitInput(null);setMessage('');setExtUploadError('');state.setError('');return true;}catch(e){report(e);return false;}}
 async function uploadExternalFiles(slotId:ExternalDocSlot,picked:File[],scrollToPreview=false){
  if(!record||!picked.length||uploading)return;
  if(picked.length>10){setExtUploadError('อัปโหลดได้ไม่เกิน 10 ไฟล์ต่อครั้ง');return;}
  const oversized=picked.find(f=>f.size>20*1024*1024);
  if(oversized){setExtUploadError(`${oversized.name}: ไฟล์มีขนาดเกิน 20 MB`);return;}
  const existingCount=(record.externalFiles??[]).length;
  if(existingCount+picked.length>100){setExtUploadError('แนบไฟล์หลักฐานภายนอกได้สูงสุด 100 ไฟล์ต่องาน');return;}
  setUploading(true);setUploadingSlot(slotId);setExtUploadError('');setSelected(slotId);
  if(scrollToPreview)requestAnimationFrame(()=>{document.getElementById('pw-preview-panel')?.scrollIntoView({behavior:'smooth',block:'start'});});
  try{
   const form=new FormData();
   picked.forEach(file=>form.append('files[]',file));
   const uploaded=await procurementJson<Array<Omit<ExternalFile,'slotId'|'includeInExport'>>>('/api/procurement/external-files',{method:'POST',body:form},'อัปโหลดไฟล์หลักฐานไม่สำเร็จ');
   const added:ExternalFile[]=uploaded.map(item=>({...item,slotId,includeInExport:true}));
   update(n=>{n.externalFiles=[...(n.externalFiles??[]),...added];});
   const pages=added.reduce((s,f)=>s+f.pages,0);
   setMessage(`แนบไฟล์เข้าช่อง ${slotId==='OTHER'?'อื่นๆ (หลักฐานเพิ่มเติม)':slotId} เรียบร้อยแล้ว (${added.length} ไฟล์ · ${pages} หน้า) — ระบบจะรวมเข้าชุดเดียวกันเมื่อส่งออก PDF / ZIP`);
  }catch(e){setExtUploadError(e instanceof Error?e.message:String(e));}
  finally{setUploading(false);setUploadingSlot(null);}
 }
 function updateExternalFile(fileId:string,patch:Partial<Pick<ExternalFile,'label'|'includeInExport'>>){
  update(n=>{n.externalFiles=(n.externalFiles??[]).map(f=>f.id===fileId?{...f,...patch}:f);});
 }
 function moveExternalFile(fileId:string,direction:-1|1){
  update(n=>{
   const all=[...(n.externalFiles??[])];
   const target=all.find(f=>f.id===fileId);if(!target)return;
   const slotIndices=all.map((f,i)=>f.slotId===target.slotId?i:-1).filter(i=>i>=0);
   const pos=slotIndices.findIndex(i=>all[i].id===fileId);
   const swapPos=pos+direction;
   if(pos<0||swapPos<0||swapPos>=slotIndices.length)return;
   const a=slotIndices[pos],b=slotIndices[swapPos];
   [all[a],all[b]]=[all[b],all[a]];
   n.externalFiles=all;
  });
 }
 function deleteExternalFile(fileId:string){
  update(n=>{n.externalFiles=(n.externalFiles??[]).filter(f=>f.id!==fileId);});
 }
 function fieldFor(issue:ValidationIssue){if(issue.field)return issue.field;if(issue.code==='BUDGET_EXCEEDED')return 'budgetSpentBefore';if(issue.code==='INSPECTOR_COMMITTEE_REQUIRED')return 'inspectorMode';if(issue.code==='PENALTY_RATE_NONSTANDARD')return 'penaltyRatePercent';if(issue.code==='DUE_DATE_ON_HOLIDAY')return 'due';const row=TIMELINE.find(r=>r[0]===issue.docIds.at(-1));return row?`docs.${row[1]}.${issue.code==='MEMO_NUMBER_OUT_OF_ORDER'?'runningNo':'date'}`:'purposeText';}
 function jumpToField(path:string){const section=path==='due'||path.startsWith('docs')||path==='inspectionResult.deliveryDate'?'timeline':path.startsWith('vendor')||path.startsWith('items')?'items':path.startsWith('signatories')||path.startsWith('inspector')?'people':path==='penaltyRatePercent'||path.startsWith('inspectionResult')?'inspection':'job';setTab(section);requestAnimationFrame(()=>{const target=document.getElementById('pw-'+path);target?.closest('details')?.setAttribute('open','');target?.scrollIntoView({block:'center',behavior:'smooth'});target?.focus();});}
 function jump(issue:ValidationIssue){jumpToField(fieldFor(issue));}
 function fix(issue:ValidationIssue){update(n=>{if(issue.code==='DUE_DATE_ON_HOLIDAY')n.dueAcknowledged=true;else if(issue.code==='PENALTY_RATE_NONSTANDARD')n.caseInput.penaltyRatePercent=n.caseInput.procurementType==='BUY'?.2:.1;else if(issue.code==='DATE_ON_NON_WORKING_DAY'&&issue.suggestedFix){const row=TIMELINE.find(r=>r[0]===issue.docIds[0]);if(row)n.caseInput.docs[row[1]].date=issue.suggestedFix;else if(issue.docIds[0]==='5.1')n.caseInput.docs.laasDate=issue.suggestedFix;}});if(issue.code==='DUE_DATE_ON_HOLIDAY')setTab('timeline');}
 async function doExport(job:ExportJob,allow=false){if(!record)return;setExporting(true);setBlocking(null);setPdf(false);state.setError('');const snapshot=structuredClone(record);try{const version=await state.flush();const links=await core.reload();if(!links)throw Error('โหลดร่างฉบับล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง');const response=await procurementFetch('/api/procurement/export/'+job.kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:snapshot.caseInput.id,caseVersion:version,expectedVersions:Object.fromEntries(links.filter(row=>row.draft).map(row=>[row.doc_id,row.draft!.version])),allowExportWithErrors:allow,...job.kind==='pdf'?{options:job.options}:job.single?{mode:'SINGLE_DOC',docId:selected}:{mode:'ZIP_ALL'}})},180000);if(!response.ok){const data=await response.json();throw Error(data.issues?.map((i:ValidationIssue)=>i.messageTh).join('; ')||'ส่งออกไม่สำเร็จ');}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a'),ext=job.kind==='pdf'?'pdf':job.single?'docx':'zip',title=snapshot.caseInput.projectTitleShort||snapshot.caseInput.budgetLine.categoryType;const singleLabel=selected==='OTHER'?'เอกสารหลักฐานเพิ่มเติม':(computed?buildBinderManifest(computed).find(row=>row.docId===selected)?.title||selected:selected);link.href=url;link.download=`${total.toFixed(2)} ${title}${(job.kind==='docx'&&job.single)||(job.kind==='pdf'&&job.options.profile.mode==='SINGLE_DOC')?' '+singleLabel:''}${allow?' (ฉบับร่าง)':''}.${ext}`.replace(/[\\/:*?"<>|]/g,'-');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);const mergedExtCount=Number(response.headers.get('X-External-File-Count')||'0');setMessage(job.kind==='pdf'&&mergedExtCount>0?`ส่งออก PDF ชุดรวมสำเร็จ (รวมไฟล์หลักฐานภายนอก ${mergedExtCount} ไฟล์) กรุณาตรวจ PDF ก่อนพิมพ์`:'ส่งออกสำเร็จ กรุณาตรวจไฟล์ก่อนพิมพ์');if(!allow&&(job.kind==='docx'&&!job.single||job.kind==='pdf'&&job.options.profile.mode!=='SINGLE_DOC'))setCommitInput(snapshot.caseInput);}catch(e){report(e);}finally{setExporting(false);}}
 function requestExport(job:ExportJob){if(issues.some(i=>i.severity==='ERROR')){setBlocking(job);return;}void doExport(job);}
 async function archiveCaseLocal(){if(!record)return;setExporting(true);state.setError('');try{await state.flush();const res=await procurementFetch('/api/handover-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'archiveProcurementCase',caseId:record.caseInput.id,includePdf:false})},180000);const data=await res.json();if(!res.ok)throw Error(data.error||data.issues?.map((i:ValidationIssue)=>i.messageTh).join('; ')||'จัดเก็บลงโฟลเดอร์ไม่สำเร็จ');setMessage(`จัดเก็บแฟ้ม Word ลงโฟลเดอร์แล้ว: ${data.folder} (สร้างใหม่ ${data.created} · อัปเดต ${data.updated} · เหมือนเดิม ${data.unchanged})`);}catch(e){report(e);}finally{setExporting(false);}}
 function requestPdf(){if(issues.some(i=>i.severity==='ERROR'))setBlocking({kind:'pdf',options:{...record!.pdfDefaults,profile:{mode:'FULL_BINDER'}}});else setPdf(true);}
 function finishEntry(){const issue=issues.find(i=>i.severity==='ERROR');if(issue){jump(issue);state.setError('กรุณาตรวจข้อมูลก่อนสร้างชุดร่าง: '+issue.messageTh);return;}void core.saveSet();}
 async function clone(){if(!record)return;const next=cloneCaseSafely(record);if(await open(next))setMessage('คัดลอกโครงสร้างงานเดิมแล้ว และล้างเลขที่หนังสือ วันที่ และรูปภาพเก่าออกทั้งหมดเพื่อป้องกันข้อมูลค้าง · กรุณากรอกยอดเบิกแล้วก่อนรายการนี้ใหม่');}
 const masterModal=masterTab!==null&&<MasterDataDrawer record={state.master} initialTab={masterTab} onSave={state.setMaster} onClose={()=>setMasterTab(null)}/>;
 if(!state.ready)return <div className="pw-workspace"><p role={state.error?'alert':'status'}>{state.error||'กำลังเปิดงานจัดซื้อจัดจ้าง…'}</p>{state.error&&<button onClick={()=>location.reload()}>ลองใหม่</button>}</div>;
 if(!record){
  return <ProcurementCaseList cases={state.cases} error={state.error} busy={busy} onStartNew={type=>void startNew(type)} onOpen={r=>void open(r)} onQuickSave={async updated=>{await state.quickSaveCase(updated);}} onOpenMaster={()=>setMasterTab('agency')} onOpenArchive={onArchive} onOpenSample={kind=>void open(kind==='hire'?sampleHireCase():sampleCase(kind==='1520'?1520:22890))}>{masterModal}</ProcurementCaseList>;
 }
 const mode=record.caseInput.workflowModeOverride==='AUTO'?(total<=5000?'MANUAL_UNDER_5000':'EGP_OVER_5000'):record.caseInput.workflowModeOverride;
 const editor={record,master:state.master.data,update};
 const linkedDocIds=new Set(core.links.filter(row=>row.draft).map(row=>row.doc_id));
 const externalFiles=record.externalFiles??[];
 const terms=getProcurementTerms(record.caseInput.procurementType);
 const activeManifest=buildBinderManifest(computed??{workflowMode:mode,manualDocumentOverrides:record.caseInput.manualDocumentOverrides,terms,inspectorBindings:Object.fromEntries(['6.1','6.2','11.1','11.2','11.3'].map(id=>[id,record.caseInput.inspectors])),penaltyRatePercent:record.caseInput.penaltyRatePercent??terms.defaultPenaltyRatePercent});
 const allSlotIds:ExternalDocSlot[]=[...activeManifest.map(row=>row.docId),'OTHER'];
 const selectedRow=activeManifest.find(row=>row.docId===selected);
 const isSelectedExternal=selected==='OTHER'||(!!selectedRow&&selectedRow.source!=='GENERATED');
 const selectedDocTitle=selected==='OTHER'?'เอกสารหลักฐานเพิ่มเติม (ต่อท้ายแฟ้ม)':selectedRow?.title;
 const selectedSlotFiles=externalFiles.filter(f=>f.slotId===selected);
 function selectPreview(id:ExternalDocSlot,scrollToPreview=false){setSelected(id);setExtUploadError('');if(scrollToPreview)requestAnimationFrame(()=>{const el=document.getElementById('pw-preview-panel');if(!el)return;const rect=el.getBoundingClientRect();if(rect.top>window.innerHeight-260||rect.bottom<120)el.scrollIntoView({behavior:'smooth',block:'start'});});}
 function jumpToBinder(){const el=document.getElementById('pw-binder-board') as HTMLDetailsElement|null;if(!el)return;el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});}
 return <div className="pw-workspace" aria-busy={exporting}><TopCommandBar procurementType={record.caseInput.procurementType} title={record.caseInput.projectTitleShort??''} mode={mode==='MANUAL_UNDER_5000'?'โหมดพิมพ์มือครบชุด (๑๕ ฉบับ)':'โหมด e-GP (พิมพ์มือ ๗ ฉบับ: ๑–๔.๑, ๑๑.๑, ๑๑.๓ และ ๑๓)'} saving={state.saving} dirty={state.dirty} busy={busy} canDownloadSingleWord={!isSelectedExternal} canUndo={!!state.history.length} onUndo={state.undo} onBack={()=>{void state.close().catch(report);}} onSave={()=>{void state.flush().catch(report);}} onClone={()=>void clone()} onMaster={()=>setMasterTab('agency')} onPdf={requestPdf} onWord={single=>requestExport({kind:'docx',single})} onArchiveLocal={()=>void archiveCaseLocal()}/>
 {state.error&&<p className="pw-banner pw-error" role="alert">{state.error} <button onClick={()=>void state.flush().catch(report)}>ลองบันทึกอีกครั้ง</button>{record.version>0&&<button disabled={busy} onClick={()=>{if(confirm('เปิดข้อมูลล่าสุดที่บันทึกไว้ และละทิ้งการแก้ไขที่ยังไม่บันทึกของหน้าต่างนี้?'))void state.reload().catch(report);}}>เปิดข้อมูลที่บันทึกล่าสุด</button>}</p>}{message&&<p className="pw-banner pw-info" role="status">{message}</p>}{exporting&&<p className="pw-banner" role="status">กำลังจัดหน้าและสร้างไฟล์ โปรดรอสักครู่…</p>}
 {commitInput&&<div className="pw-card pw-row"><strong>บันทึกเลขที่หนังสือล่าสุดลงทะเบียนคุมเลขรัน?</strong><button onClick={async()=>{try{setRegistry(await procurementRepository.advanceNumberingRegistry(commitInput));setCommitInput(null);setMessage('บันทึกทะเบียนคุมเลขรันแล้ว งานถัดไปจะเสนอเลขใหม่ตามทะเบียนทั้ง 5 ประเภท');}catch(e){report(e);}}}>บันทึกเลขลงทะเบียน</button><button onClick={()=>setCommitInput(null)}>ภายหลัง</button></div>}
 <CoreDraftBridge controller={core} disabled={busy}/>
 <BinderNavigator input={record.caseInput} agency={record.agency} computed={computed} selected={selected} linkedDocIds={linkedDocIds} externalFiles={externalFiles} uploadingSlot={uploadingSlot} onSelect={id=>selectPreview(id,true)} onOpenDraft={id=>void core.open(id)} onJumpField={jumpToField} onQuickUpload={(slotId,picked)=>void uploadExternalFiles(slotId,picked,true)} busy={busy||core.loading} onOverride={(id,value)=>update(n=>{n.caseInput.manualDocumentOverrides=value?[...n.caseInput.manualDocumentOverrides,id]:n.caseInput.manualDocumentOverrides.filter(v=>v!==id);})}/>
 <div className="pw-split"><div className="pw-form"><nav className="pw-tabs" aria-label="ขั้นตอนกรอกข้อมูล">{sections.map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{id==='items'&&record.caseInput.procurementType==='HIRE'?'2 รายการงานจ้าง / ผู้รับจ้าง':label}</button>)}</nav><p className="pw-hint">ข้อความจางที่ขึ้นต้น “ตัวอย่าง:” เป็นแนวทางเท่านั้น กรุณากรอกข้อมูลจริง · ช่องตัวเลขจะแปลงเป็นตัวอักษรและเลขไทยในเอกสารให้อัตโนมัติ</p>
 {tab==='job'&&<JobBudgetSection {...editor}/>} {tab==='items'&&<ItemsVendorSection {...editor} onAddVendor={()=>setMasterTab('vendors')}/>} {tab==='people'&&<InspectorsSignatoriesSection {...editor}/>} {tab==='timeline'&&<TimelineNumberingSection {...editor} computed={computed} registry={registry} onError={state.setError}/>} {tab==='inspection'&&<InspectionPhotosSection {...editor} computed={computed} onUploadBusy={setUploading}/>}
 <footer className="pw-row"><button disabled={busy||tab===sections[0][0]} onClick={()=>{const index=sections.findIndex(([id])=>id===tab);setTab(sections[Math.max(0,index-1)][0]);}}>ก่อนหน้า</button><button disabled={busy||core.loading} className="pw-primary" onClick={()=>{const index=sections.findIndex(([id])=>id===tab);if(index===sections.length-1){finishEntry();return;}setTab(sections[index+1][0]);}}>{tab===sections.at(-1)![0]?'ตรวจและสร้างชุดร่าง':'ถัดไป'}</button><button disabled={busy} onClick={()=>{if(confirm('ลบงานนี้ออกจากแบบฟอร์มชุดใหม่?'))void state.remove().catch(report);}}>ลบงานนี้</button></footer></div>
 <aside className="pw-right"><ValidationPanel issues={issues} dueAcknowledged={record.dueAcknowledged} onJump={jump} onFix={fix}/>{isSelectedExternal?<ExternalSlotPreview slotId={selected} slotTitle={selectedDocTitle||'เอกสารภายนอก'} sourceLabel={selected==='OTHER'?sourceLabels.OTHER:(sourceLabels[selectedRow?.source??'']||'เอกสารภายนอก')} slotIds={allSlotIds} files={selectedSlotFiles} busy={busy||core.loading} uploading={uploadingSlot===selected} uploadError={extUploadError} onSelectSlot={id=>selectPreview(id,false)} onJumpBinder={jumpToBinder} onUpload={(slotId,picked)=>uploadExternalFiles(slotId,picked,false)} onUpdateFile={updateExternalFile} onMoveFile={moveExternalFile} onDeleteFile={deleteExternalFile} onDownloadSlotPdf={()=>requestExport({kind:'pdf',options:{...record.pdfDefaults,includeExternalFiles:true,profile:{mode:'SINGLE_DOC',docId:selected}}})}/>:<CoreA4Preview caseId={record.caseInput.id} docId={selected} docTitle={selectedDocTitle} docIds={allSlotIds} draft={core.links.find(row=>row.doc_id===selected)?.draft} loading={core.loading||core.busy} onSelectDoc={id=>selectPreview(id as ExternalDocSlot,false)} onJumpBinder={jumpToBinder} onReload={()=>void core.reload()} onCreate={finishEntry} onEdit={()=>void core.open(selected)} onDownload={kind=>requestExport(kind==='pdf'?{kind,options:{...record.pdfDefaults,profile:{mode:'SINGLE_DOC',docId:selected}}}:{kind,single:true})}/>}</aside></div>
 {masterModal}{pdf&&<ExportPdfModal defaults={record.pdfDefaults} docId={selected} externalFiles={externalFiles} onClose={()=>setPdf(false)} onExport={options=>{update(n=>{const nextDefaults={duplicateCopies:options.duplicateCopies??true,includeDividers:options.includeDividers??true,includeCoverChecklist:options.includeCoverChecklist??false,includeExternalFiles:options.includeExternalFiles??true,routingStripMode:options.routingStripMode??'FIRST_COPY_ONLY'};n.pdfDefaults=nextDefaults;try{localStorage.setItem('sarabun.procurement.pdf-defaults',JSON.stringify(nextDefaults));}catch{}});requestExport({kind:'pdf',options});}}/>}{blocking&&<BlockingErrorModal issues={issues} canOverride={ProcurementCaseInputSchema.safeParse(cleanForExport(record.caseInput)).success} onClose={()=>setBlocking(null)} onOverride={()=>void doExport(blocking,true)}/>}</div>;
}
