'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import type {ExternalDocSlot,ExternalFile} from '@/lib/procurement/workspace/model';

const PdfPreview=dynamic(()=>import('@/components/pdf-preview').then(m=>m.PdfPreview));

function formatBytes(bytes:number){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

export function ExternalSlotPreview({
  slotId,
  slotTitle,
  sourceLabel,
  slotIds,
  files,
  busy,
  uploading,
  uploadError,
  onSelectSlot,
  onJumpBinder,
  onUpload,
  onUpdateFile,
  onMoveFile,
  onDeleteFile,
  onDownloadSlotPdf,
}:{
  slotId:ExternalDocSlot;
  slotTitle:string;
  sourceLabel:string;
  slotIds:ExternalDocSlot[];
  files:ExternalFile[];
  busy:boolean;
  uploading:boolean;
  uploadError:string;
  onSelectSlot:(id:ExternalDocSlot)=>void;
  onJumpBinder:()=>void;
  onUpload:(slotId:ExternalDocSlot,selected:File[])=>Promise<void>;
  onUpdateFile:(fileId:string,patch:Partial<Pick<ExternalFile,'label'|'includeInExport'>>)=>void;
  onMoveFile:(fileId:string,direction:-1|1)=>void;
  onDeleteFile:(fileId:string)=>void;
  onDownloadSlotPdf:()=>void;
}){
  const inputRef=useRef<HTMLInputElement>(null);
  const [activeId,setActiveId]=useState<string>('');
  const [dragging,setDragging]=useState(false);

  useEffect(()=>{
    if(!files.length){setActiveId('');return;}
    if(!files.some(f=>f.id===activeId))setActiveId(files[0].id);
  },[files,activeId]);

  const idx=slotIds.indexOf(slotId);
  const prevId=idx>0?slotIds[idx-1]:undefined;
  const nextId=idx>=0&&idx<slotIds.length-1?slotIds[idx+1]:undefined;
  const activeFile=files.find(f=>f.id===activeId)??files[0]??null;
  const includedCount=files.filter(f=>f.includeInExport).length;
  const totalPages=files.reduce((sum,f)=>sum+f.pages,0);

  async function handleFiles(fileList:FileList|File[]|null){
    if(!fileList||!fileList.length)return;
    const picked=Array.from(fileList);
    if(inputRef.current)inputRef.current.value='';
    await onUpload(slotId,picked);
  }

  return (
    <section id="pw-preview-panel" className="pw-card pw-preview pw-ext-panel" aria-label="หลักฐานเอกสารภายนอก">
      <div className="pw-preview-head">
        <div className="pw-preview-title">
          <span className="pw-binder-num pw-ext-num">{slotId==='OTHER'?'อื่นๆ':slotId}</span>
          <div>
            <strong>{slotId==='OTHER'?'เอกสารหลักฐานเพิ่มเติม (อื่นๆ)':`หลักฐานแนบ · เอกสาร ${slotId}`}</strong>
            <small className="pw-muted">{slotTitle} · {sourceLabel}</small>
          </div>
        </div>
        <div className="pw-row">
          {slotIds.length>1&&(
            <div className="pw-preview-stepper" role="group" aria-label="เปลี่ยนช่องเอกสาร">
              <button type="button" disabled={busy||!prevId} title={prevId?`ช่องก่อนหน้า (${prevId==='OTHER'?'อื่นๆ':prevId})`:undefined} onClick={()=>prevId&&onSelectSlot(prevId)}>‹ ก่อนหน้า</button>
              <button type="button" disabled={busy||!nextId} title={nextId?`ช่องถัดไป (${nextId==='OTHER'?'อื่นๆ':nextId})`:undefined} onClick={()=>nextId&&onSelectSlot(nextId)}>ถัดไป ›</button>
            </div>
          )}
          <button type="button" onClick={onJumpBinder}>↑ การเรียงแฟ้ม</button>
          {includedCount>0&&(
            <button type="button" disabled={busy} onClick={onDownloadSlotPdf}>โหลด PDF ช่องนี้</button>
          )}
        </div>
      </div>

      <p className="pw-hint">
        {slotId==='14'
          ? 'อัปโหลดเอกสารวางฎีกาเบิกเงินที่พิมพ์/ดาวน์โหลดจากระบบ e-LAAS (PDF หรือภาพสแกน) เพื่อเก็บคู่กับบันทึกขออนุมัติเบิกจ่ายเงิน (ข้อ 13) และรวมเข้าแฟ้มชุดเดียวกันอัตโนมัติเมื่อส่งออก PDF / ZIP / แฟ้มงานเครื่อง'
          : 'อัปโหลดเอกสารที่ไม่ได้สร้างจากระบบ (เช่น e-LAAS, ใบเสนอราคา, บิลส่งของ, เอกสารคู่เทียบ, e-GP หรือหลักฐานอื่น) เพื่อเก็บไว้กับงานนี้และรวมเข้าชุดเดียวกันอัตโนมัติเมื่อส่งออก PDF / ZIP'}
      </p>

      <div
        className={`pw-ext-drop${dragging?' is-dragging':''}`}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);void handleFiles(e.dataTransfer.files);}}
      >
        <label>
          <strong>{uploading?'กำลังอัปโหลดและจัดรูปแบบเป็น PDF…':'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์หลักฐาน'}</strong>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label={`อัปโหลดไฟล์สำหรับ ${slotId==='OTHER'?'เอกสารเพิ่มเติม':`เอกสาร ${slotId}`}`}
            disabled={busy||uploading}
            onChange={e=>void handleFiles(e.currentTarget.files)}
          />
          <small>รองรับ PDF, JPG, PNG และ WebP (สูงสุด 20 MB/ไฟล์ · เลือกได้หลายไฟล์ · รูปภาพจะปรับแนวและจัดลงหน้า A4 อัตโนมัติ)</small>
        </label>
      </div>

      {uploading&&<p className="pw-banner pw-info" role="status">กำลังอัปโหลดและจัดเก็บไฟล์หลักฐาน…</p>}
      {uploadError&&<p className="pw-banner pw-error" role="alert">{uploadError}</p>}

      {files.length>0&&(
        <div className="pw-ext-list" aria-label="รายการไฟล์ที่แนบในช่องนี้">
          <div className="pw-ext-list-head">
            <strong>ไฟล์ที่แนบไว้แล้ว ({files.length} ไฟล์ · รวม {totalPages} หน้า)</strong>
            <small className="pw-muted">เปิดรวมส่งออก {includedCount}/{files.length} ไฟล์</small>
          </div>
          {files.map((file,index)=>{
            const isViewing=activeFile?.id===file.id;
            return (
              <div key={file.id} className={`pw-ext-item${isViewing?' is-viewing':''}`}>
                <div className="pw-ext-item-top">
                  <span className="pw-ext-idx">{index+1}</span>
                  <input
                    type="text"
                    className="pw-ext-label-input"
                    aria-label={`ชื่อเอกสารไฟล์ที่ ${index+1}`}
                    value={file.label}
                    maxLength={240}
                    placeholder={file.originalName||file.name}
                    disabled={busy}
                    onChange={e=>onUpdateFile(file.id,{label:e.target.value})}
                  />
                  <button
                    type="button"
                    className={`pw-ext-view-btn${isViewing?' is-active':''}`}
                    onClick={()=>setActiveId(file.id)}
                  >
                    {isViewing?'กำลังดู':'ดูตัวอย่าง'}
                  </button>
                </div>
                <div className="pw-ext-item-meta">
                  <small>{file.pages} หน้า · {formatBytes(file.bytes)} · {file.originalName||file.name}</small>
                </div>
                <div className="pw-ext-item-controls">
                  <label className="pw-check pw-ext-include">
                    <input
                      type="checkbox"
                      checked={file.includeInExport}
                      disabled={busy}
                      onChange={e=>onUpdateFile(file.id,{includeInExport:e.target.checked})}
                    />
                    <span>รวมตอนส่งออก PDF/ZIP</span>
                  </label>
                  <div className="pw-row pw-ext-btns">
                    <button type="button" title="เลื่อนขึ้น" aria-label={`เลื่อนไฟล์ที่ ${index+1} ขึ้น`} disabled={busy||index===0} onClick={()=>onMoveFile(file.id,-1)}>↑</button>
                    <button type="button" title="เลื่อนลง" aria-label={`เลื่อนไฟล์ที่ ${index+1} ลง`} disabled={busy||index===files.length-1} onClick={()=>onMoveFile(file.id,1)}>↓</button>
                    <a className="pw-ext-link" href={`/api/attachments/${file.id}?original=1`}>ต้นฉบับ</a>
                    <a className="pw-ext-link" href={`/api/attachments/${file.id}`} target="_blank" rel="noreferrer">เปิดเต็มจอ</a>
                    <button type="button" className="pw-ext-del" disabled={busy} onClick={()=>onDeleteFile(file.id)}>ลบ</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pw-preview-canvas pw-ext-canvas">
        {activeFile?(
          <div className="pw-ext-pdf-wrap">
            <div className="pw-ext-pdf-bar">
              <strong>{activeFile.label||activeFile.originalName||activeFile.name}</strong>
              <span>{activeFile.pages} หน้า</span>
            </div>
            <PdfPreview url={`/api/attachments/${activeFile.id}`} title={activeFile.label||activeFile.name}/>
          </div>
        ):(
          <div className="pw-ext-empty-preview">
            <p>ยังไม่ได้แนบไฟล์ในช่อง <strong>{slotId==='OTHER'?'อื่นๆ (หลักฐานเพิ่มเติม)':`${slotId} · ${slotTitle}`}</strong></p>
            <p className="pw-muted">
              เมื่ออัปโหลดไฟล์ PDF หรือรูปภาพแล้ว ระบบจะบันทึกเก็บไว้ในฐานข้อมูลและนำมารวมตามตำแหน่งนี้โดยอัตโนมัติในไฟล์ส่งออกชุดเดียวกัน (ถ้ายังไม่แนบ ระบบจะใส่แผ่นคั่นให้แทนเมื่อเปิดตัวเลือกแผ่นคั่น)
            </p>
          </div>
        )}
      </div>

      <small>
        เก็บไฟล์ต้นฉบับ + PDF พร้อมรวมแฟ้ม · {files.length?`${files.length} ไฟล์ (${totalPages} หน้า)`:'ยังไม่มีไฟล์แนบ'}
      </small>
    </section>
  );
}
