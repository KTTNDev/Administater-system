'use client';
import {useMemo,useState} from 'react';
import {buildBinderManifest} from '@/lib/procurement/manifest';
import {getProcurementTerms} from '@/lib/procurement/calculations';
import type {DraftCase,ExternalDocSlot,ExternalFile} from '@/lib/procurement/workspace/model';
import {getBinderDocControl,type BinderDocControl} from '@/lib/procurement/workspace/binder-control';
import {formAmounts} from '../fields';
import type {AgencyConfig,ComputedProcurementCase} from '@/lib/procurement/types';

type FilterMode='ALL'|'GENERATED'|'EXTERNAL'|'NEEDS_CONTROL'|'STAGE_1'|'STAGE_2'|'STAGE_3'|'STAGE_4';

const sourceLabels:Record<string,string>={
  GENERATED:'ระบบสร้าง',
  VENDOR_EXTERNAL:'ร้านค้า',
  LAAS_EXTERNAL:'LAAS',
  EGP_EXTERNAL:'e-GP',
  OTHER:'เพิ่มเติม',
};

const stageMeta={
  STAGE_1:{label:'๑ ขออนุมัติ/สเปก',short:'ขั้น ๑',ids:['1','2','3','4.1','4.2']},
  STAGE_2:{label:'๒ ขอซื้อ/แต่งตั้ง',short:'ขั้น ๒',ids:['5.1','5.2','6.1','6.2','7']},
  STAGE_3:{label:'๓ ประกาศ/สั่งซื้อ',short:'ขั้น ๓',ids:['8','9','10']},
  STAGE_4:{label:'๔ ตรวจรับ/เบิกจ่าย',short:'ขั้น ๔',ids:['11.1','11.2','11.3','11.4','11.5','12','13','14']},
} as const;

type StageKey=keyof typeof stageMeta;

function stageOf(docId:string):StageKey{
  if((stageMeta.STAGE_1.ids as readonly string[]).includes(docId))return 'STAGE_1';
  if((stageMeta.STAGE_2.ids as readonly string[]).includes(docId))return 'STAGE_2';
  if((stageMeta.STAGE_3.ids as readonly string[]).includes(docId))return 'STAGE_3';
  return 'STAGE_4';
}

const EyeIcon=()=>(
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EditIcon=()=>(
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"/>
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
  </svg>
);

const UploadIcon=()=>(
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" x2="12" y1="3" y2="15"/>
  </svg>
);

function BinderControlStrip({
  docId,
  control,
  busy,
  onJumpField,
}:{
  docId:string;
  control:BinderDocControl;
  busy:boolean;
  onJumpField?:(fieldPath:string)=>void;
}){
  const isComplete=control.status==='COMPLETE';
  const isMissing=control.needsAttention;
  const variant=isMissing?'is-missing':isComplete?'is-complete':'is-muted';
  const clickable=!!(onJumpField&&control.jumpField);
  const title=clickable
    ? `คลิกเพื่อไปกรอกเลขคุม / วันที่ของเอกสาร ${docId} ในขั้น 4`
    : undefined;

  const content=(
    <>
      <span className="pw-binder-control-body">
        {control.numberText&&(
          <span className={control.missingNumberLabel?'pw-ctrl-missing':'pw-ctrl-num'}>{control.numberText}</span>
        )}
        {!control.numberText&&control.missingNumberLabel&&(
          <span className={isMissing?'pw-ctrl-missing':''}>{control.missingNumberLabel}</span>
        )}
        {!control.numberText&&!control.missingNumberLabel&&control.contextNote&&(
          <span>{control.contextNote}</span>
        )}
        {(control.dateText||control.missingDateLabel)&&(
          <>
            {(control.numberText||control.missingNumberLabel||control.contextNote)&&<span className="pw-ctrl-sep">·</span>}
            {control.dateText
              ? <span className="pw-ctrl-date">{control.dateText}</span>
              : <span className={isMissing?'pw-ctrl-missing':''}>{control.missingDateLabel}</span>}
          </>
        )}
      </span>
      {clickable&&<span className="pw-ctrl-go">{isMissing?'กรอก →':'แก้'}</span>}
    </>
  );

  if(!clickable){
    return <div className={`pw-binder-control ${variant}`} data-control-status={control.status}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`pw-binder-control ${variant}`}
      data-control-status={control.status}
      disabled={busy}
      title={title}
      aria-label={`เลขคุมและวันที่เอกสาร ${docId}`}
      onClick={()=>onJumpField(control.jumpField!)}
    >
      {content}
    </button>
  );
}

export function BinderNavigator({
  computed,
  input,
  agency,
  selected,
  linkedDocIds,
  externalFiles=[],
  uploadingSlot=null,
  onSelect,
  onOverride,
  onOpenDraft,
  onJumpField,
  onQuickUpload,
  busy=false,
}:{
  computed:ComputedProcurementCase|null;
  input:DraftCase;
  agency:AgencyConfig;
  selected:string;
  linkedDocIds?:ReadonlySet<string>;
  externalFiles?:readonly ExternalFile[];
  uploadingSlot?:string|null;
  onSelect:(id:ExternalDocSlot)=>void;
  onOverride:(id:string,value:boolean)=>void;
  onOpenDraft?:(id:string)=>void;
  onJumpField?:(fieldPath:string)=>void;
  onQuickUpload?:(slotId:ExternalDocSlot,files:File[])=>void;
  busy?:boolean;
}){
  const [filter,setFilter]=useState<FilterMode>('ALL');
  const terms=getProcurementTerms(input.procurementType),total=formAmounts(input.items,input.vendor.isVatRegistered).grandTotal;
  const manifest=useMemo(
    ()=>buildBinderManifest(computed??{
      workflowMode:input.workflowModeOverride==='AUTO'?(total>5000?'EGP_OVER_5000':'MANUAL_UNDER_5000'):input.workflowModeOverride,
      manualDocumentOverrides:input.manualDocumentOverrides,
      terms,
      inspectorBindings:Object.fromEntries(['6.1','6.2','11.1','11.2','11.3'].map(id=>[id,input.inspectors])),
      penaltyRatePercent:input.penaltyRatePercent??terms.defaultPenaltyRatePercent,
    }),
    [computed,input.workflowModeOverride,input.manualDocumentOverrides,input.inspectors,input.penaltyRatePercent,terms,total],
  );

  const filesBySlot=useMemo(()=>{
    const map=new Map<string,ExternalFile[]>();
    for(const f of externalFiles){
      const list=map.get(f.slotId)??[];
      list.push(f);
      map.set(f.slotId,list);
    }
    return map;
  },[externalFiles]);

  const controlsByDocId=useMemo(()=>{
    const map=new Map<string,BinderDocControl>();
    for(const row of manifest){
      map.set(row.docId,getBinderDocControl(row.docId,input,agency,row.source));
    }
    return map;
  },[manifest,input,agency]);

  const generatedCount=manifest.filter(r=>r.source==='GENERATED').length;
  const externalCount=manifest.length-generatedCount;
  const requiredControls=manifest.map(r=>controlsByDocId.get(r.docId)!).filter(c=>c.required);
  const requiredTotal=requiredControls.length;
  const pendingCount=requiredControls.filter(c=>c.needsAttention).length;
  const requiredReady=requiredTotal-pendingCount;
  const totalExternalFiles=externalFiles.length;
  const totalExternalPages=externalFiles.reduce((sum,f)=>sum+f.pages,0);
  const selectedRow=manifest.find(r=>r.docId===selected);
  const visibleRows=manifest.filter(row=>{
    if(filter==='ALL')return true;
    if(filter==='GENERATED')return row.source==='GENERATED';
    if(filter==='EXTERNAL')return row.source!=='GENERATED';
    if(filter==='NEEDS_CONTROL')return !!controlsByDocId.get(row.docId)?.needsAttention;
    return stageOf(row.docId)===filter;
  });
  const showOtherCard=filter==='ALL'||filter==='EXTERNAL';
  const otherFiles=filesBySlot.get('OTHER')??[];
  const otherPages=otherFiles.reduce((sum,f)=>sum+f.pages,0);

  const isHire=input.procurementType==='HIRE';
  const filters:[FilterMode,string][]=[
    ['ALL',`ทั้งหมด (${manifest.length}+1)`],
    ['GENERATED',`ระบบสร้าง (${generatedCount})`],
    ['EXTERNAL',`แนบภายนอก (${externalCount}+1)`],
    ['NEEDS_CONTROL',pendingCount>0?`รอจองเลข/วันที่ (${pendingCount})`:'จองเลขครบแล้ว ✓'],
    ['STAGE_1',stageMeta.STAGE_1.label],
    ['STAGE_2',isHire?'๒ ขอจ้าง/แต่งตั้ง':stageMeta.STAGE_2.label],
    ['STAGE_3',isHire?'๓ ประกาศ/สั่งจ้าง':stageMeta.STAGE_3.label],
    ['STAGE_4',stageMeta.STAGE_4.label],
  ];

  return (
    <details id="pw-binder-board" className="pw-card pw-binder" open>
      <summary className="pw-binder-summary">
        <div className="pw-binder-summary-main">
          <strong>การเรียงแฟ้ม · {manifest.length} ตำแหน่ง (+ อื่นๆ)</strong>
          <span className="pw-binder-summary-stat">
            ระบบสร้าง <b>{generatedCount}</b> ฉบับ · แนบภายนอก <b>{externalCount}</b> ช่อง
            {' · '}
            {pendingCount===0
              ? <span className="pw-ctrl-summary-ok">เลขคุมครบ {requiredReady}/{requiredTotal} ✓</span>
              : <span className="pw-ctrl-summary-wait">เลขคุม {requiredReady}/{requiredTotal} (รอจอง/ลงวันที่ {pendingCount})</span>}
            {totalExternalFiles>0&&<> · แนบไฟล์แล้ว <b>{totalExternalFiles} ไฟล์ ({totalExternalPages} หน้า)</b></>}
            {selected==='OTHER'?<> · กำลังดู: <b>หลักฐานเพิ่มเติม (อื่นๆ)</b></>:selectedRow&&<> · กำลังดู: <b>เอกสาร {selectedRow.docId}</b></>}
          </span>
        </div>
        <span className="pw-binder-summary-tip">คลิกแถบเลขคุมบนการ์ดเพื่อข้ามไปกรอกเลขที่/วันที่ในขั้น 4 ได้ทันที</span>
      </summary>

      <div className="pw-binder-toolbar" role="group" aria-label="ตัวกรองเอกสารในแฟ้ม">
        {filters.map(([key,label])=>(
          <button
            key={key}
            type="button"
            className={`pw-binder-filter${key==='NEEDS_CONTROL'&&pendingCount>0?' is-warn':''}${filter===key?' is-active':''}`}
            aria-pressed={filter===key}
            onClick={()=>setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {filter==='NEEDS_CONTROL'&&visibleRows.length===0&&(
        <p className="pw-hint">เอกสารที่ต้องมีเลขคุมทั้งหมด ({requiredTotal} ฉบับ) จองเลขและลงวันที่ครบถ้วนแล้วครับ</p>
      )}

      <nav className="pw-binder-grid" aria-label="ลายแทงเรียงแฟ้ม">
        {visibleRows.map(row=>{
          const isGenerated=row.source==='GENERATED';
          const isSelected=row.docId===selected;
          const stage=stageOf(row.docId);
          const hasDraft=linkedDocIds?linkedDocIds.has(row.docId):false;
          const slotFiles=filesBySlot.get(row.docId)??[];
          const slotPages=slotFiles.reduce((sum,f)=>sum+f.pages,0);
          const isSlotUploading=uploadingSlot===row.docId;
          const canOverride=computed?.workflowMode==='EGP_OVER_5000'&&!['1','2','3','4.1','4.2','5.1','5.2','11.1','11.3','11.4','11.5','13','14'].includes(row.docId);
          const isOverridden=!!computed?.manualDocumentOverrides.includes(row.docId);
          const control=controlsByDocId.get(row.docId)!;
          return (
            <article
              key={row.docId}
              data-source={row.source}
              data-stage={stage}
              className={`pw-binder-card pw-binder-src-${row.source}${isSelected?' is-selected':''}${isGenerated?' is-generated':' is-external'}${!isGenerated&&slotFiles.length>0?' has-files':''}${control.needsAttention?' needs-control':''}`}
            >
              <div
                className="pw-binder-card-head"
                onClick={!busy?()=>onSelect(row.docId):undefined}
              >
                <span className={`pw-binder-num pw-stage-${stage.toLowerCase()}`}>{row.docId}</span>
                <div className="pw-binder-info">
                  <div className="pw-binder-title" title={`เอกสาร ${row.docId} ${row.title}`}>{row.title}</div>
                  <div className="pw-binder-badges">
                    <small className={`pw-pill pw-source-${row.source}`}>{isGenerated&&linkedDocIds?(hasDraft?'ระบบสร้าง ✓':'รอสร้างร่าง'):sourceLabels[row.source]}</small>
                    {row.copies>1&&isGenerated&&<small className="pw-pill pw-copy-pill">พิมพ์ {row.copies===3?'๓':'๒'} ชุด</small>}
                    {!isGenerated&&(
                      slotFiles.length>0
                        ? <small className="pw-pill pw-ext-attached">แนบแล้ว {slotFiles.length} ไฟล์ · {slotPages} หน้า</small>
                        : <small className="pw-pill pw-ext-empty">ยังไม่ได้แนบ</small>
                    )}
                    {isGenerated&&slotFiles.length>0&&(
                      <small className="pw-pill pw-ext-attached">+แนบ {slotFiles.length} ไฟล์</small>
                    )}
                  </div>
                </div>
              </div>

              <BinderControlStrip
                docId={row.docId}
                control={control}
                busy={busy}
                onJumpField={onJumpField}
              />

              <div className="pw-binder-actions">
                {isGenerated?(
                  <>
                    <button
                      type="button"
                      className={`pw-binder-btn pw-binder-preview${isSelected?' is-active':''}`}
                      disabled={busy}
                      aria-label={`ดูตัวอย่างเอกสาร ${row.docId}`}
                      aria-pressed={isSelected}
                      onClick={()=>onSelect(row.docId)}
                    >
                      <EyeIcon/>
                      <span>{isSelected?'กำลังดู':'ดูตัวอย่าง'}</span>
                    </button>
                    <button
                      type="button"
                      className="pw-binder-btn pw-binder-edit"
                      disabled={busy}
                      aria-label={`เอกสาร ${row.docId} ${row.title}`}
                      aria-current={isSelected?'page':undefined}
                      onClick={()=>onOpenDraft?onOpenDraft(row.docId):onSelect(row.docId)}
                    >
                      <EditIcon/>
                      <span>แก้ไข</span>
                    </button>
                  </>
                ):(
                  <>
                    <button
                      type="button"
                      className={`pw-binder-btn pw-binder-preview${isSelected?' is-active':''}`}
                      disabled={busy}
                      aria-label={`ดูหลักฐานเอกสาร ${row.docId}`}
                      aria-pressed={isSelected}
                      onClick={()=>onSelect(row.docId)}
                    >
                      <EyeIcon/>
                      <span>{isSelected?'กำลังดู':slotFiles.length>0?'ดู/จัดการ':'เปิดช่องแนบ'}</span>
                    </button>
                    {onQuickUpload&&(
                      <label className={`pw-binder-btn pw-binder-upload${busy||isSlotUploading?' is-disabled':''}`}>
                        <UploadIcon/>
                        <span>{isSlotUploading?'กำลังอัปโหลด…':slotFiles.length>0?'แนบเพิ่ม':'แนบไฟล์'}</span>
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          aria-label={`อัปโหลดหลักฐานเอกสาร ${row.docId}`}
                          disabled={busy||isSlotUploading}
                          onChange={e=>{
                            const picked=Array.from(e.currentTarget.files||[]);
                            e.currentTarget.value='';
                            if(picked.length)onQuickUpload(row.docId,picked);
                          }}
                        />
                      </label>
                    )}
                  </>
                )}
                {canOverride&&(
                  <label className="pw-check pw-binder-override">
                    <input
                      disabled={busy}
                      aria-label={`ร่างเองเอกสาร ${row.docId}`}
                      type="checkbox"
                      checked={isOverridden}
                      onChange={e=>onOverride(row.docId,e.target.checked)}
                    />
                    <span>ร่างเอง</span>
                  </label>
                )}
              </div>
            </article>
          );
        })}

        {showOtherCard&&(
          <article
            data-source="OTHER"
            data-stage="STAGE_4"
            className={`pw-binder-card pw-binder-src-OTHER is-external${selected==='OTHER'?' is-selected':''}${otherFiles.length>0?' has-files':''}`}
          >
            <div className="pw-binder-card-head" onClick={!busy?()=>onSelect('OTHER'):undefined}>
              <span className="pw-binder-num pw-ext-other-num">อื่นๆ</span>
              <div className="pw-binder-info">
                <div className="pw-binder-title" title="เอกสารหลักฐานเพิ่มเติมอื่นๆ (ต่อท้ายแฟ้มเมื่อส่งออก)">เอกสารหลักฐานเพิ่มเติม (อื่นๆ)</div>
                <div className="pw-binder-badges">
                  <small className="pw-pill pw-source-OTHER">เพิ่มเติม</small>
                  {otherFiles.length>0
                    ? <small className="pw-pill pw-ext-attached">แนบแล้ว {otherFiles.length} ไฟล์ · {otherPages} หน้า</small>
                    : <small className="pw-pill pw-ext-empty">ต่อท้ายแฟ้ม</small>}
                </div>
              </div>
            </div>
            <div className="pw-binder-actions">
              <button
                type="button"
                className={`pw-binder-btn pw-binder-preview${selected==='OTHER'?' is-active':''}`}
                disabled={busy}
                aria-label="ดูหลักฐานเพิ่มเติมอื่นๆ"
                aria-pressed={selected==='OTHER'}
                onClick={()=>onSelect('OTHER')}
              >
                <EyeIcon/>
                <span>{selected==='OTHER'?'กำลังดู':otherFiles.length>0?'ดู/จัดการ':'เปิดช่องแนบ'}</span>
              </button>
              {onQuickUpload&&(
                <label className={`pw-binder-btn pw-binder-upload${busy||uploadingSlot==='OTHER'?' is-disabled':''}`}>
                  <UploadIcon/>
                  <span>{uploadingSlot==='OTHER'?'กำลังอัปโหลด…':otherFiles.length>0?'แนบเพิ่ม':'แนบไฟล์'}</span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    aria-label="อัปโหลดหลักฐานเพิ่มเติมอื่นๆ"
                    disabled={busy||uploadingSlot==='OTHER'}
                    onChange={e=>{
                      const picked=Array.from(e.currentTarget.files||[]);
                      e.currentTarget.value='';
                      if(picked.length)onQuickUpload('OTHER',picked);
                    }}
                  />
                </label>
              )}
            </div>
          </article>
        )}
      </nav>
    </details>
  );
}
