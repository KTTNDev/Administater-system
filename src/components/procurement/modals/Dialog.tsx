import {useEffect,useRef,type ReactNode} from 'react';
export function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();const d=ref.current;return()=>d?.close();},[]);
 return <dialog ref={ref} className={'pw-dialog '+(wide?'pw-dialog-wide':'')} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><div className="pw-dialog-head"><h2>{title}</h2><button aria-label="ปิดหน้าต่าง" onClick={onClose}>×</button></div>{children}</dialog>;
}
