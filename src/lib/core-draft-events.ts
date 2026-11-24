export const CORE_DRAFT_SAVED='sarabun.core.saved';
/** Metadata only: cross-tab previews reload the persisted draft, never unsaved editor text. */
export function notifyCoreDraftSaved(id:string,version:number){
 const value=JSON.stringify({id,version,at:Date.now()});
 try{localStorage.setItem(CORE_DRAFT_SAVED,value);}catch{}
 window.dispatchEvent(new Event(CORE_DRAFT_SAVED));
}
