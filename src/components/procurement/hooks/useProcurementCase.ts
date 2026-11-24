'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {procurementRepository as repository, type MasterRecord} from '@/lib/procurement/storage/repository';
import {emptyMaster,evaluateDraft,type StoredCase} from '@/lib/procurement/workspace/model';
const digest=(r:StoredCase)=>JSON.stringify({...r,version:0,updatedAt:''});
export function useProcurementCase(onDirty:(v:boolean)=>void,onBusy:(v:boolean)=>void){
  const [record,setRecord]=useState<StoredCase|null>(null),[cases,setCases]=useState<StoredCase[]>([]),[master,setMaster]=useState<MasterRecord>({data:emptyMaster(),version:0}),[ready,setReady]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[history,setHistory]=useState<StoredCase[]>([]);
  const latest=useRef(record),saved=useRef(''),pending=useRef<Promise<void>|null>(null),alive=useRef(true),versions=useRef(new Map<string,number>());
  latest.current=record;
  useEffect(()=>{alive.current=true;Promise.all([repository.listCases(),repository.getMasterData()]).then(([rows,m])=>{if(alive.current){setCases(rows);setMaster(m);setReady(true);}}).catch(e=>{if(alive.current)setError(String(e));});return()=>{alive.current=false;};},[]);
  useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
  useEffect(()=>()=>{onDirty(false);onBusy(false);},[onDirty,onBusy]);
  const flush=useCallback(async()=>{
    if(pending.current)await pending.current;
    const current=latest.current;if(!current)return;if(digest(current)===saved.current)return versions.current.get(current.caseInput.id)??current.version;
    setSaving(true);setError('');
    const operation=(async()=>{const snapshot={...current,version:versions.current.get(current.caseInput.id)??current.version};const result=await repository.saveCase(snapshot);versions.current.set(result.caseInput.id,result.version);saved.current=digest(current);if(alive.current){setCases(rows=>[result,...rows.filter(r=>r.caseInput.id!==result.caseInput.id)]);setRecord(now=>now?.caseInput.id===result.caseInput.id?{...now,version:result.version,updatedAt:result.updatedAt}:now);setDirty(latest.current?digest(latest.current)!==saved.current:false);}})();
    pending.current=operation;
    try{await operation;return versions.current.get(current.caseInput.id);}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');throw e;}finally{pending.current=null;if(alive.current)setSaving(false);}
  },[]);
  useEffect(()=>{if(!record)return;const changed=digest(record)!==saved.current;setDirty(changed);if(!changed)return;const timer=setTimeout(()=>{void flush().catch(()=>{});},600);return()=>clearTimeout(timer);},[record,flush]);
  const open=async(next:StoredCase)=>{await flush();versions.current.set(next.caseInput.id,next.version);saved.current=next.version?digest(next):'';setHistory([]);latest.current=next;setRecord(next);setDirty(!next.version);};
  const update=(mutate:(next:StoredCase)=>void)=>{const previous=latest.current;if(!previous)return;const next=structuredClone(previous);mutate(next);setHistory(h=>[...h.slice(-19),previous]);latest.current=next;setRecord(next);};
  const undo=()=>{const previous=history.at(-1);if(!previous||!record)return;const next={...previous,version:record.version,updatedAt:record.updatedAt};latest.current=next;setRecord(next);setHistory(h=>h.slice(0,-1));};
  const remove=async()=>{await flush();const current=latest.current;if(!current)return;await repository.deleteCase(current.caseInput.id,versions.current.get(current.caseInput.id)??current.version);setCases(rows=>rows.filter(r=>r.caseInput.id!==current.caseInput.id));latest.current=null;setRecord(null);saved.current='';setDirty(false);};
  const evaluation=useMemo(()=>record?evaluateDraft(record.caseInput):{computed:null,issues:[]},[record]);
  const close=async()=>{await flush();latest.current=null;setRecord(null);setDirty(false);setHistory([]);};
  const quickSaveCase=useCallback(async(next:StoredCase)=>{
    setSaving(true);setError('');
    try{
      const version=versions.current.get(next.caseInput.id)??next.version;
      const result=await repository.saveCase({...next,version});
      versions.current.set(result.caseInput.id,result.version);
      if(alive.current){
        setCases(rows=>rows.map(r=>r.caseInput.id===result.caseInput.id?result:r));
        setRecord(now=>now?.caseInput.id===result.caseInput.id?result:now);
      }
      return result;
    }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');throw e;}finally{if(alive.current)setSaving(false);}
  },[]);
  const reload=async()=>{const id=latest.current?.caseInput.id;if(!id)return;setSaving(true);try{if(pending.current)await pending.current.catch(()=>{});const next=await repository.getCase(id);if(!next)throw Error('ไม่พบงานที่บันทึกไว้ กรุณากลับรายการงาน');versions.current.set(id,next.version);saved.current=digest(next);latest.current=next;setRecord(next);setDirty(false);setHistory([]);setError('');}finally{setSaving(false);}};
  return {record,cases,master,setMaster,ready,error,setError,saving,dirty,history,update,undo,open,close,flush,remove,reload,quickSaveCase,...evaluation};
}
