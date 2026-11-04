'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {PenLine,X} from 'lucide-react';
import {buildWritingPrompt,writingContext,writingInputSchema,writingTasks,type WritingInput,type WritingModel} from '@/lib/ai-writing';
import s from './ai-writing-assistant.module.css';

// This state intentionally lives outside the document/recovery model. Closing the
// dialog discards the key and pending answer; only an explicit Apply changes value.
export function AIWritingAssistant({value,onChange,maxLength=10000}:{value:string;onChange:(value:string)=>void;maxLength?:number}) {
  const [open,setOpen]=useState(false),[provider,setProvider]=useState<'gemini'|'aipass'>('gemini');
  const [apiKey,setApiKey]=useState(''),[models,setModels]=useState<WritingModel[]>([]),[model,setModel]=useState('');
  const [task,setTask]=useState<WritingInput['task']>('draft'),[instruction,setInstruction]=useState(''),[context,setContext]=useState('');
  const [answer,setAnswer]=useState(''),[base,setBase]=useState(value),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [truncated,setTruncated]=useState(false),[confirmReplace,setConfirmReplace]=useState(false);
  const [undo,setUndo]=useState<{before:string;after:string}|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),request=useRef<AbortController|null>(null),serial=useRef(0);
  const id=useId(),changed=value!==base;
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  useEffect(()=>()=>{serial.current++;request.current?.abort();},[]);
  function cancel(){serial.current++;request.current?.abort();request.current=null;setBusy(false);}
  function close(){cancel();setOpen(false);setApiKey('');setModels([]);setModel('');setInstruction('');setContext('');setAnswer('');setError('');setMessage('');setTruncated(false);setConfirmReplace(false);setUndo(null);}
  function begin(){setBase(value);setOpen(true);}
  function input():WritingInput|null {
    const result=writingInputSchema.safeParse({task,instruction,context});
    if(!result.success){setError('ระบุสิ่งที่ต้องการให้ช่วยก่อน (ไม่เกิน 8,000 ตัวอักษร และข้อมูลประกอบไม่เกิน 16,000 ตัวอักษร)');return null;}
    return result.data;
  }
  async function send(action:'models'|'generate'){
    setError('');setMessage('');setConfirmReplace(false);
    if(!apiKey.trim()){setError('ใส่ Gemini API key จาก Google AI Studio ก่อน');return;}
    const fields=action==='generate'?input():null;if(action==='generate'&&!fields)return;
    if(action==='generate'&&!model){setError('โหลดรายชื่อและเลือกโมเดลก่อน');return;}
    cancel();const current=++serial.current;const controller=new AbortController();request.current=controller;setBusy(true);
    const original=value;
    try{
      const response=await fetch('/api/ai-writing',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,
        body:JSON.stringify({action,apiKey:apiKey.trim(),...(fields?{...fields,model}:{})})});
      const data=await response.json();if(current!==serial.current)return;
      if(!response.ok)throw Error(typeof data.error==='string'?data.error:'เรียก AI ไม่สำเร็จ');
      if(action==='models'){
        const available:WritingModel[]=Array.isArray(data.models)?data.models:[];setModels(available);setModel(available[0]?.name||'');
        setMessage(available.length?'เลือกโมเดล แล้วระบุสิ่งที่ต้องการให้ช่วย':'บัญชีนี้ไม่มีโมเดลสร้างข้อความที่เรียกใช้ได้');
      }else{
        if(typeof data.text!=='string')throw Error('ไม่พบข้อความตอบกลับ');
        setAnswer(data.text);setBase(original);setTruncated(Boolean(data.truncated));setMessage('ตรวจแก้คำตอบก่อนนำเข้าเอกสาร');
      }
    }catch(e){if(current===serial.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'ติดต่อ AI ไม่สำเร็จ');}
    finally{if(current===serial.current){setBusy(false);request.current=null;}}
  }
  async function copyPrompt(){setError('');const fields=input();if(!fields)return;try{await navigator.clipboard.writeText(buildWritingPrompt(fields));setBase(value);setMessage('คัดลอกคำสั่งแล้ว เปิด AIThaiPass วางคำสั่ง แล้วนำคำตอบมาวางด้านล่าง');}catch{setError('คัดลอกอัตโนมัติไม่ได้ เปิด “ดูคำสั่ง” แล้วคัดลอกข้อความเอง');}}
  function apply(mode:'append'|'replace'){
    if(!answer.trim()||busy)return;
    if(mode==='replace'&&changed){setError('เนื้อหาในเอกสารเปลี่ยนหลังเตรียมคำขอแล้ว กรุณาคัดลอกคำตอบหรือเพิ่มต่อท้ายแทน');setConfirmReplace(false);return;}
    if(mode==='replace'&&value.trim()&&!confirmReplace){setConfirmReplace(true);return;}
    const next=mode==='append'&&value?value+(value.endsWith('\n')?'':'\n')+answer.trim():answer.trim();
    if(next.length>maxLength){setError(`ข้อความรวมยาวเกิน ${maxLength.toLocaleString('th-TH')} ตัวอักษรสำหรับการนำเข้าช่องนี้ กรุณาย่อคำตอบหรือคัดลอกเฉพาะส่วนที่ต้องการ`);setConfirmReplace(false);return;}
    setUndo({before:value,after:next});onChange(next);setBase(next);setConfirmReplace(false);setMessage('นำข้อความเข้าแล้ว สามารถย้อนกลับการนำเข้าครั้งล่าสุดได้');
  }
  return <>
    <button type="button" className={s.launch} onClick={begin}><PenLine size={16}/>ช่วยเขียนด้วย AI</button>
    {open&&createPortal(<dialog ref={dialog} className={s.dialog} aria-labelledby={id+'-title'} onCancel={e=>{e.preventDefault();close();}}>
      <header className={s.header}><div><h2 id={id+'-title'}>ช่วยเขียนด้วย AI</h2><p>คิดประเด็น เรียบเรียง และตรวจแก้ก่อนนำเข้าเอกสาร</p></div><button type="button" onClick={close} aria-label="ปิดผู้ช่วย AI"><X size={20}/></button></header>
      <div className={s.content}>
        <label htmlFor={id+'-provider'}>บริการ</label><select id={id+'-provider'} value={provider} disabled={busy} onChange={e=>{cancel();setProvider(e.target.value as typeof provider);setApiKey('');setModels([]);setModel('');setError('');setMessage('');}}><option value="gemini">Gemini API</option><option value="aipass">TH-AI Passport · คัดลอกคำสั่ง</option></select>
        {provider==='gemini'?<section className={s.connection} aria-label="เชื่อม Gemini">
          <label htmlFor={id+'-key'}>Gemini API key</label><input id={id+'-key'} type="password" autoComplete="off" spellCheck={false} maxLength={500} value={apiKey} disabled={busy} onChange={e=>{setApiKey(e.target.value);setModels([]);setModel('');}}/>
          <p className={s.note}>ใช้ key จาก <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a> ไม่ใช่รหัสผ่าน Gemini · key อยู่เฉพาะหน้าต่างนี้และถูกล้างเมื่อปิด</p>
          <div className={s.actions}><button type="button" disabled={busy||!apiKey.trim()} onClick={()=>void send('models')}>โหลดรายชื่อโมเดล</button><button type="button" disabled={!apiKey&&!busy} onClick={()=>{cancel();setApiKey('');setModels([]);setModel('');setMessage('ล้าง API key แล้ว');}}>ล้าง key</button></div>
          {!!models.length&&<><label htmlFor={id+'-model'}>โมเดล</label><select id={id+'-model'} value={model} disabled={busy} onChange={e=>setModel(e.target.value)}>{models.map(m=><option key={m.name} value={m.name}>{m.displayName} · {m.name.replace('models/','')}</option>)}</select></>}
        </section>:<p className={s.note}>สร้างคำสั่งในระบบนี้ แล้วนำไปใช้ด้วยตัวเองที่ <a href="https://aipass.go.th/" target="_blank" rel="noreferrer">AIThaiPass ↗</a> จากนั้นวางคำตอบด้านล่าง · <a href="https://aipass.go.th/term-and-cond-th" target="_blank" rel="noreferrer">เงื่อนไขข้อ 3.4</a> จำกัดการเชื่อม API นอกหน้าจอบริการ</p>}
        <label htmlFor={id+'-task'}>ต้องการให้ช่วย</label><select id={id+'-task'} value={task} disabled={busy} onChange={e=>setTask(e.target.value as WritingInput['task'])}>{Object.entries(writingTasks).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        <label htmlFor={id+'-instruction'}>คำขอและข้อเท็จจริงที่ต้องใช้</label><textarea id={id+'-instruction'} rows={3} value={instruction} maxLength={8000} disabled={busy} onChange={e=>setInstruction(e.target.value)} placeholder="เช่น ร่างขออนุมัติจัดประชุม ระบุวัตถุประสงค์ กลุ่มเป้าหมาย วันเวลา และงบประมาณที่ทราบ"/>
        <div className={s.labelRow}><label htmlFor={id+'-context'}>ข้อมูลประกอบ (เลือกส่งเฉพาะที่จำเป็น)</label><button type="button" disabled={busy} onClick={()=>{const text=writingContext(value);if(text.length>16000){setError('เนื้อหายาวเกิน 16,000 ตัวอักษร กรุณาคัดลอกเฉพาะส่วนที่ต้องการลงข้อมูลประกอบ');return;}setContext(text);}}>ใช้ข้อความจากช่องนี้</button></div>
        <textarea id={id+'-context'} rows={4} value={context} maxLength={16000} disabled={busy} onChange={e=>setContext(e.target.value)} placeholder="ยังไม่ส่งข้อความในเอกสารจนกว่าคุณจะเลือกหรือใส่ข้อมูลที่นี่"/>
        <p className={s.note}>ส่งเฉพาะคำขอและข้อมูลประกอบที่แสดงนี้ให้บริการที่เลือก กรุณาตัดข้อมูลลับและข้อมูลส่วนบุคคลที่ไม่จำเป็น · Gemini ใช้โควตาและอาจมีค่าใช้จ่ายตามบัญชีของคุณ</p>
        <div className={s.actions}>{provider==='gemini'?<button type="button" className="primary" disabled={busy||!model||!instruction.trim()} onClick={()=>void send('generate')}>{busy?'กำลังรอ Gemini…':'ให้ Gemini ช่วยเขียน'}</button>:<button type="button" className="primary" onClick={()=>void copyPrompt()}>คัดลอกคำสั่ง</button>}{busy&&<button type="button" onClick={()=>{cancel();setMessage('หยุดรอคำตอบแล้ว คำขอที่ส่งไปอาจใช้โควตาไปแล้ว');}}>หยุดรอ</button>}</div>
        {provider==='aipass'&&<details><summary>ดูคำสั่ง</summary><textarea aria-label="คำสั่งสำหรับ AIThaiPass" readOnly rows={8} value={buildWritingPrompt({task,instruction,context})}/></details>}
        {error&&<p className={s.error} role="alert">{error}</p>}{message&&<p className={s.status} role="status">{message}</p>}
        <section className={s.review} aria-label="ตรวจคำตอบ AI"><label htmlFor={id+'-answer'}>คำตอบ · แก้ไขก่อนนำเข้าเอกสาร</label><textarea id={id+'-answer'} rows={7} maxLength={30000} value={answer} disabled={busy} onChange={e=>{setAnswer(e.target.value);setConfirmReplace(false);}} placeholder={provider==='aipass'?'วางคำตอบจาก AIThaiPass ที่นี่':'คำตอบจะแสดงที่นี่ โดยยังไม่เปลี่ยนเอกสาร'}/>
          {truncated&&<p className={s.error}>คำตอบอาจถูกตัดเพราะถึงขีดจำกัด ตรวจและเติมเนื้อหาให้ครบก่อนนำไปใช้</p>}
          {changed&&<p className={s.note}>เนื้อหาในเอกสารเปลี่ยนแล้ว จึงใช้ได้เฉพาะคัดลอกหรือเพิ่มต่อท้าย เพื่อป้องกันการทับงานล่าสุด</p>}
          <p className={s.note}>ตรวจชื่อ วันที่ ตัวเลข และข้อกฎหมายกับแหล่งอ้างอิงจริงก่อนใช้ คำตอบถูกนำเข้าเป็นข้อความ คุณยังจัดรูปแบบต่อได้ตามเดิม</p>
          <div className={s.actions}><button type="button" disabled={!answer.trim()||busy} onClick={()=>apply('append')}>เพิ่มต่อท้าย</button><button type="button" disabled={!answer.trim()||busy||changed} onClick={()=>apply('replace')}>{confirmReplace?'ยืนยันแทนที่ข้อความเดิม':'แทนที่ข้อความช่องนี้'}</button>{confirmReplace&&<button type="button" onClick={()=>setConfirmReplace(false)}>ยกเลิกแทนที่</button>}<button type="button" disabled={!answer.trim()} onClick={()=>void navigator.clipboard.writeText(answer).then(()=>setMessage('คัดลอกคำตอบแล้ว')).catch(()=>setError('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกเอง'))}>คัดลอกคำตอบ</button>{undo&&<button type="button" disabled={value!==undo.after||busy} onClick={()=>{onChange(undo.before);setBase(undo.before);setUndo(null);setMessage('ย้อนกลับการนำเข้าครั้งล่าสุดแล้ว');}}>ย้อนกลับการนำเข้า</button>}</div>
        </section>
      </div>
    </dialog>,document.body)}
  </>;
}
