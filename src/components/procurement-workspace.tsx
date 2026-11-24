'use client';
import {useEffect,useState} from 'react';
import type {SavedDraft} from '@/lib/document';
import {ProcurementWorkspace as SingleEntryWorkspace} from './procurement/ProcurementWorkspace';
import {ProcurementArchive} from './procurement/ProcurementArchive';
export function ProcurementWorkspace(props:{department:string;requestedCase?:{caseId:string;docId?:string}|null;onRequestedCaseHandled?:()=>void;onDirty:(value:boolean)=>void;onBusy:(value:boolean)=>void;onOpenDocument?:(draft:SavedDraft)=>boolean|void;onDraftsChanged?:(drafts:SavedDraft[])=>void}){
  const [archive,setArchive]=useState<string|null>(null);
  useEffect(()=>{const query=new URLSearchParams(location.search),id=query.get('archiveCase')||query.get('case');if(id)setArchive(id);},[]);
  useEffect(()=>{if(props.requestedCase)setArchive(null);},[props.requestedCase]);
  function closeArchive(){const url=new URL(location.href);for(const key of ['archiveCase','case','step'])url.searchParams.delete(key);history.replaceState(null,'',url);setArchive(null);}
  return archive?<ProcurementArchive caseId={archive} onBack={closeArchive}/>:<SingleEntryWorkspace {...props} onArchive={()=>setArchive('*')}/>;
}
