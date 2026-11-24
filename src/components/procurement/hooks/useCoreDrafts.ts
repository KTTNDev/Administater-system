'use client';
import {useEffect,useRef,useState} from 'react';
import type {SavedDraft} from '@/lib/document';
import type {LinkedCoreDraft} from '@/lib/procurement/core/bindings';
import {CORE_DRAFT_SAVED} from '@/lib/core-draft-events';
import {procurementJson} from '@/lib/procurement/storage/client-request';

async function api(caseId:string,body?:unknown):Promise<LinkedCoreDraft[]>{
  return procurementJson<LinkedCoreDraft[]>('/api/procurement/core-drafts'+(body?'':`?caseId=${encodeURIComponent(caseId)}`),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'},'เชื่อมร่างหนังสือไม่สำเร็จ',120000);
}
export function useCoreDrafts({caseId,disabled,flush,onBusy,onOpenDocument,onDraftsChanged}:{caseId?:string;disabled:boolean;flush:()=>Promise<number|undefined>;onBusy:(value:boolean)=>void;onOpenDocument?:(draft:SavedDraft)=>boolean|void;onDraftsChanged?:(drafts:SavedDraft[])=>void}){
  const [links,setLinks]=useState<LinkedCoreDraft[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[opening,setOpening]=useState<SavedDraft|null>(null);
  const lock=useRef(false),generation=useRef(0);
  useEffect(()=>{if(opening&&!busy&&!disabled&&onOpenDocument?.(opening)!==false)setOpening(null);},[opening,busy,disabled,onOpenDocument]);
  useEffect(()=>{
    const epoch=++generation.current;setLinks([]);setError('');setMessage('');setOpening(null);setLoading(!!caseId);
    if(caseId)api(caseId).then(rows=>{if(epoch===generation.current)setLinks(rows);}).catch(e=>{if(epoch===generation.current)setError(String(e));}).finally(()=>{if(epoch===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[caseId]);
  function publish(rows:LinkedCoreDraft[]){setLinks(rows);onDraftsChanged?.(rows.flatMap(row=>row.draft?[row.draft]:[]));}
  async function perform(action:(id:string,version:number)=>Promise<void>){
    if(!caseId||disabled||lock.current)return;
    lock.current=true;setBusy(true);onBusy(true);setError('');setMessage('');
    try{const version=await flush();if(!version)throw Error('กรุณาบันทึกข้อมูลหลักของงานก่อนสร้างร่าง');await action(caseId,version);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{lock.current=false;setBusy(false);onBusy(false);}
  }
  async function saveSet(){await perform(async(id,version)=>{
    let rows=await api(id);const existing=rows.length>0;
    if(existing&&!confirm('อัปเดตหัวหนังสือ เนื้อหา และชื่อผู้ลงนามจากข้อมูลกลาง? ข้อความส่วนนี้ที่แก้ในร่างจะถูกแทนที่ โดยเก็บลายเซ็น Text Box ภาพ และไฟล์แนบไว้'))return;
    if(rows.length<15)rows=await api(id,{caseId:id,caseVersion:version,mode:'create'});
    if(existing)rows=await api(id,{caseId:id,caseVersion:version,mode:'sync',expectedVersions:Object.fromEntries(rows.filter(row=>row.draft).map(row=>[row.doc_id,row.draft!.version]))});
    publish(rows);setMessage(existing?'อัปเดตเนื้อหาแล้ว โดยเก็บลายเซ็น Text Box รูปภาพ และไฟล์แนบเดิมไว้':'เชื่อมร่างครบ 15 ฉบับแล้ว เปิดแก้ไขได้ในระบบร่างหนังสือ');
    const warnings=[...new Set(rows.flatMap(row=>row.localFileWarning?[row.localFileWarning]:[]))];
    if(warnings.length)setError('บันทึกฐานข้อมูลแล้ว แต่ทำสำเนาไฟล์ในเครื่องไม่ครบ: '+warnings.join('; '));
  });}
  async function open(docId:string){await perform(async(id,version)=>{
    let rows=await api(id);
    // Opening creates missing links once and never implicitly Syncs edited Core content.
    if(!rows.some(row=>row.doc_id===docId))rows=await api(id,{caseId:id,caseVersion:version,mode:'create'});
    publish(rows);const draft=rows.find(row=>row.doc_id===docId)?.draft;
    if(!draft)throw Error('ร่างอยู่ในถังขยะ กรุณากู้คืนร่างเดิมก่อนเปิด');
    setOpening(draft);
  });}
  async function reload(){if(!caseId||lock.current)return;const epoch=generation.current;setLoading(true);try{const rows=await api(caseId);if(epoch===generation.current){setLinks(rows);setError('');return rows;}}catch(e){if(epoch===generation.current)setError(String(e));}finally{if(epoch===generation.current)setLoading(false);}}
  useEffect(()=>{
    if(!caseId)return;
    const refresh=()=>{if(document.visibilityState==='visible')void reload();};
    const storage=(event:StorageEvent)=>{if(event.key===CORE_DRAFT_SAVED)refresh();};
    window.addEventListener('focus',refresh);window.addEventListener(CORE_DRAFT_SAVED,refresh);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);window.removeEventListener(CORE_DRAFT_SAVED,refresh);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refresh);};
  },[caseId]);
  return {links,busy,loading,error,message,saveSet,open,reload};
}
export type CoreDraftController=ReturnType<typeof useCoreDrafts>;
