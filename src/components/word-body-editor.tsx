"use client";
import {useEffect,useRef,useState} from 'react';
import {bodyEditorHtml,serializeBodyEditor} from '@/lib/body-typography';
export function WordBodyEditor({value,onChange,id,required}:{value:string;onChange:(s:string)=>void;id?:string;required?:boolean}){
 const root=useRef<HTMLDivElement>(null),range=useRef<Range|null>(null),initialized=useRef(false);const [spacing,setSpacing]=useState('0'),[message,setMessage]=useState('');
 useEffect(()=>{const el=root.current;if(el&&(!initialized.current||(document.activeElement!==el&&serializeBodyEditor(el)!==value))){el.innerHTML=bodyEditorHtml(value);initialized.current=true;}},[value]);
 const save=()=>{if(root.current)onChange(serializeBodyEditor(root.current));remember();};
 const remember=()=>{const selection=window.getSelection();if(selection?.rangeCount&&root.current?.contains(selection.anchorNode)){range.current=selection.getRangeAt(0).cloneRange();}};
 function restore(){root.current?.focus();const selection=window.getSelection();if(range.current&&root.current?.contains(range.current.startContainer)){selection?.removeAllRanges();selection?.addRange(range.current);}}
 function command(name:string,arg?:string){restore();document.execCommand(name,false,arg);save();remember();}
 function track(){restore();const selected=window.getSelection();if(!selected?.rangeCount||selected.isCollapsed){setMessage('เลือกข้อความที่ต้องการปรับก่อน');return;}const r=selected.getRangeAt(0);const block=(n:Node)=>(n instanceof Element?n:n.parentElement)?.closest('p,div,h3');if(block(r.startContainer)!==block(r.endContainer)){setMessage('ปรับทีละย่อหน้า: เลือกข้อความภายในย่อหน้าเดียว');return;}
 const span=document.createElement('span');span.dataset.tracking=spacing;span.style.letterSpacing=spacing+'pt';span.append(r.cloneContents());document.execCommand('insertHTML',false,span.outerHTML);remember();save();setMessage('ปรับระยะข้อความที่เลือก '+spacing+' pt แล้ว');}
 return <div className="word-body-editor">
 <div role="toolbar" aria-label="จัดข้อความแบบ Word" onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault();}}>
 <button type="button" onClick={()=>command('bold')}>ตัวหนา</button>
 <button type="button" onClick={()=>command('insertParagraph')}>ย่อหน้าใหม่</button>
 <button type="button" onClick={()=>command('insertLineBreak')}>ขึ้นบรรทัดใหม่</button>
 <button type="button" onClick={()=>command('formatBlock','h3')}>หัวข้อ</button>
 <button type="button" onClick={()=>command('formatBlock','p')}>เนื้อหา</button>
 <label>ระยะอักษร (pt)<select aria-label="ระยะตัวอักษรที่เลือก" value={spacing} onChange={e=>setSpacing(e.target.value)}>{['-1','-0.5','-0.3','-0.2','-0.1','0','0.1','0.2','0.3','0.5','1','2','3'].map(n=><option key={n} value={n}>{Number(n)<0?'บีบ ':Number(n)>0?'ขยาย ':'ปกติ '}{n}</option>)}</select></label>
 <button type="button" onClick={track}>ใช้กับข้อความที่เลือก</button>
 </div>
 <p className="word-body-help">Enter = ย่อหน้าใหม่ · Shift+Enter = ขึ้นบรรทัดในย่อหน้าเดิม · เลือกข้อความก่อนบีบ/ขยาย</p>
 {message&&<p role="status">{message}</p>}
 <div id={id} ref={root} className="word-body-surface" contentEditable suppressContentEditableWarning role="textbox" aria-label="เนื้อหาแบบจัดข้อความ" aria-multiline="true" aria-required={required} onInput={save} onMouseUp={remember} onKeyUp={remember}
 onPaste={e=>{e.preventDefault();const plain=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,plain);save();remember();}}
 onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Enter'){e.preventDefault();command(e.shiftKey?'insertLineBreak':'insertParagraph');}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){e.preventDefault();command('bold');}}}/>
 </div>;
}
