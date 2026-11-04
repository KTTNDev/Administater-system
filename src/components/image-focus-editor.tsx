'use client';
import {useEffect,useRef,useState} from 'react';
import {defaultImageFocus,dragImageFocus,imageDisplayBox,type ImageFocus} from '@/lib/image-focus';

export function ImageFocusEditor({src,value,onChange,label='ตำแหน่งภาพ',kind='header',fit='cover',artHeight=210,opacity=1,disabled=false}:{src:string;value:ImageFocus;onChange:(focus:ImageFocus)=>void;label?:string;kind?:'header'|'hero'|'card'|'compact';fit?:'cover'|'art';artHeight?:number;opacity?:number;disabled?:boolean}){
 const surface=useRef<HTMLButtonElement>(null),image=useRef<HTMLImageElement>(null),drag=useRef<{pointer:number;x:number;y:number;focus:ImageFocus;overflowX:number;overflowY:number}|null>(null);
 const [size,setSize]=useState({width:0,height:0}),[natural,setNatural]=useState({width:0,height:0,source:''}),[failed,setFailed]=useState(false);
 // A saved data URL may finish loading from SSR markup before React attaches
 // onLoad. Read the completed element as well, so reopening never stays blank.
 useEffect(()=>{setFailed(false);const element=image.current;if(element?.complete){if(element.naturalWidth)setNatural({width:element.naturalWidth,height:element.naturalHeight,source:src});else if(src)setFailed(true);}},[src]);
 useEffect(()=>{const el=surface.current;if(!el)return;const update=()=>setSize({width:el.clientWidth,height:el.clientHeight});update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();},[]);
 const box=imageDisplayBox(size.width,size.height,natural.source===src?natural.width:0,natural.source===src?natural.height:0,value,fit,artHeight);
 return <section className="image-focus-editor" aria-label={label}>
  <button type="button" ref={surface} className="image-focus-preview" data-kind={kind} disabled={disabled||!src||failed} aria-label={label+' · ลากภาพหรือตั้งค่าด้วยลูกศร'}
   onPointerDown={e=>{if(e.button!==0||!box.width)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,focus:{...value},overflowX:box.width-size.width,overflowY:box.height-size.height};}}
   onPointerMove={e=>{const start=drag.current;if(!start||start.pointer!==e.pointerId)return;onChange(dragImageFocus(start.focus,e.clientX-start.x,e.clientY-start.y,start.overflowX,start.overflowY));}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
   onKeyDown={e=>{const delta=e.shiftKey?5:1;const direction:{[key:string]:[number,number]}={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};const change=direction[e.key];if(change){e.preventDefault();onChange({...value,x:Math.max(0,Math.min(100,value.x+change[0])),y:Math.max(0,Math.min(100,value.y+change[1]))});}}}>
   {src&&<img ref={image} src={src} alt="" draggable={false} onLoad={e=>{setFailed(false);setNatural({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight,source:src});}} onError={()=>setFailed(true)} style={{width:box.width||'100%',height:box.height||'100%',left:box.left,top:box.top,opacity,visibility:box.width?'visible':'hidden'}}/>}
   <span className="image-focus-cross" aria-hidden="true"/><span className="image-focus-caption">{failed?'อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่':'พื้นที่ที่จะแสดงจริง · ลากเพื่อเลื่อนภาพ'}</span>
  </button>
  <div className="image-focus-controls">
   <label>ซ้าย–ขวา {Math.round(value.x)}%<input type="range" aria-label={label+' ซ้าย–ขวา'} min="0" max="100" step="0.1" value={value.x} disabled={disabled} onChange={e=>onChange({...value,x:Number(e.target.value)})}/></label>
   <label>บน–ล่าง {Math.round(value.y)}%<input type="range" aria-label={label+' บน–ล่าง'} min="0" max="100" step="0.1" value={value.y} disabled={disabled} onChange={e=>onChange({...value,y:Number(e.target.value)})}/></label>
   <label>ซูม {value.zoom}%<input type="range" aria-label={label+' ซูม'} min="100" max="250" step="5" value={value.zoom} disabled={disabled} onChange={e=>onChange({...value,zoom:Number(e.target.value)})}/></label>
  </div>
  <div className="image-focus-help"><small>หากเลื่อนไม่ได้ในบางแกน ให้ซูมเพิ่มก่อน · ใช้ปุ่มลูกศรเลื่อนละเอียดได้</small><button type="button" disabled={disabled} onClick={()=>onChange(defaultImageFocus())}>จัดภาพกึ่งกลาง</button></div>
 </section>;
}
