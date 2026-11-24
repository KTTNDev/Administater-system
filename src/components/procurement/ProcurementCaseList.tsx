'use client';
import {Fragment,useMemo,useState,type ReactNode} from 'react';
import type {CaseWorkStatus,StoredCase} from '@/lib/procurement/workspace/model';
import {
  deriveCaseFiscalYear,
  deriveCaseMonthKey,
  FISCAL_MONTH_ORDER,
  formatThaiMonthYear,
  groupCasesByFiscalMonth,
  NOTE_QUICK_CHIPS,
  summarizeCaseNumbers,
  WORK_STATUS_LIST,
  WORK_STATUS_MAP,
} from '@/lib/procurement/workspace/tracker';
import {formAmounts,money} from './fields';

const NoteIcon=()=>(
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"/>
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
  </svg>
);

export function ProcurementCaseList({
  cases,
  error,
  busy,
  onStartNew,
  onOpen,
  onQuickSave,
  onOpenMaster,
  onOpenArchive,
  onOpenSample,
  children,
}:{
  cases:StoredCase[];
  error:string;
  busy:boolean;
  onStartNew:(type:'BUY'|'HIRE')=>void;
  onOpen:(record:StoredCase)=>void;
  onQuickSave:(record:StoredCase)=>Promise<void>;
  onOpenMaster:()=>void;
  onOpenArchive:()=>void;
  onOpenSample:(kind:'1520'|'22890'|'hire')=>void;
  children?:ReactNode;
}){
  const [typeFilter,setTypeFilter]=useState<'ALL'|'BUY'|'HIRE'>('ALL');
  const [yearFilter,setYearFilter]=useState<string>('ALL');
  const [monthFilter,setMonthFilter]=useState<string>('ALL');
  const [statusFilter,setStatusFilter]=useState<'ALL'|CaseWorkStatus>('ALL');
  const [search,setSearch]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draftStatus,setDraftStatus]=useState<CaseWorkStatus>('RESERVING_NUMBERS');
  const [draftMonth,setDraftMonth]=useState('');
  const [draftNote,setDraftNote]=useState('');
  const [savingNote,setSavingNote]=useState(false);
  const [noteMessage,setNoteMessage]=useState('');

  const caseAmount=(r:StoredCase)=>formAmounts(r.caseInput.items,r.caseInput.vendor.isVatRegistered).grandTotal||0;
  const sum=(rows:StoredCase[])=>rows.reduce((n,r)=>n+caseAmount(r),0);

  const fiscalYears=useMemo(()=>{
    const set=new Set<number>();
    for(const item of cases)set.add(deriveCaseFiscalYear(item));
    return Array.from(set).sort((a,b)=>b-a);
  },[cases]);

  const yearScoped=useMemo(
    ()=>yearFilter==='ALL'?cases:cases.filter(r=>String(deriveCaseFiscalYear(r))===yearFilter),
    [cases,yearFilter],
  );

  const monthOptions=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const item of yearScoped){
      const key=deriveCaseMonthKey(item);
      if(key)counts.set(key,(counts.get(key)??0)+1);
    }
    return Array.from(counts.entries()).sort(([a],[b])=>{
      if(yearFilter!=='ALL'){
        const idxA=FISCAL_MONTH_ORDER.indexOf(a.slice(5,7) as typeof FISCAL_MONTH_ORDER[number]);
        const idxB=FISCAL_MONTH_ORDER.indexOf(b.slice(5,7) as typeof FISCAL_MONTH_ORDER[number]);
        if(idxA!==idxB)return idxB-idxA;
      }
      return b.localeCompare(a);
    });
  },[yearScoped,yearFilter]);

  const periodScoped=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return yearScoped.filter(r=>{
      if(monthFilter!=='ALL'&&deriveCaseMonthKey(r)!==monthFilter)return false;
      if(statusFilter!=='ALL'&&(r.tracker?.status??'RESERVING_NUMBERS')!==statusFilter)return false;
      if(q){
        const hay=[
          r.caseInput.projectTitleShort,
          r.caseInput.vendor.shopName,
          r.caseInput.budgetLine.categoryGroup,
          r.caseInput.budgetLine.categoryType,
          r.caseInput.purposeText,
          r.tracker?.note,
        ].filter(Boolean).join(' ').toLowerCase();
        if(!hay.includes(q))return false;
      }
      return true;
    });
  },[yearScoped,monthFilter,statusFilter,search]);

  const buyCases=periodScoped.filter(r=>r.caseInput.procurementType==='BUY');
  const hireCases=periodScoped.filter(r=>r.caseInput.procurementType==='HIRE');
  const shown=typeFilter==='ALL'?periodScoped:typeFilter==='BUY'?buyCases:hireCases;
  const groups=useMemo(()=>groupCasesByFiscalMonth(shown),[shown]);

  const hasActiveFilter=yearFilter!=='ALL'||monthFilter!=='ALL'||statusFilter!=='ALL'||typeFilter!=='ALL'||!!search.trim();

  function openNoteEditor(r:StoredCase){
    if(editingId===r.caseInput.id){setEditingId(null);return;}
    setEditingId(r.caseInput.id);
    setDraftStatus(r.tracker?.status??'RESERVING_NUMBERS');
    setDraftMonth(r.tracker?.workMonth??'');
    setDraftNote(r.tracker?.note??'');
    setNoteMessage('');
  }

  function appendChip(text:string){
    setDraftNote(prev=>{
      const trimmed=prev.trim();
      if(!trimmed)return text;
      if(trimmed.includes(text))return trimmed;
      return `${trimmed} · ${text}`;
    });
  }

  async function saveQuickNote(r:StoredCase){
    setSavingNote(true);
    setNoteMessage('');
    try{
      const updated:StoredCase={
        ...structuredClone(r),
        tracker:{status:draftStatus,workMonth:draftMonth.trim(),note:draftNote.trim()},
      };
      await onQuickSave(updated);
      setEditingId(null);
      setNoteMessage('บันทึกสถานะและโน้ตเรียบร้อยแล้ว');
    }finally{
      setSavingNote(false);
    }
  }

  const heading=typeFilter==='ALL'
    ? `ทะเบียนคุมงานจัดซื้อจัดจ้าง (${shown.length} งาน)`
    : typeFilter==='BUY'
      ? `ทะเบียนคุมงานจัดซื้อ (${shown.length} งาน)`
      : `ทะเบียนคุมงานจัดจ้าง (${shown.length} งาน)`;

  return (
    <div className="pw-workspace">
      <header className="pw-command">
        <h1>จัดซื้อจัดจ้าง · กรอกครั้งเดียวใช้ทุกเอกสาร</h1>
        <p>แบ่งดูตามปีงบประมาณและเดือน พร้อมจดบันทึกติดตามการจองเลขในสมุดคุมมือจริง เมื่อได้เลขครบทุกวันแล้วกดเปิดงานเพื่อสร้างเอกสารทั้งชุดรวดเดียว</p>
        <div className="pw-row">
          <button className="pw-primary" onClick={()=>onStartNew('BUY')}>+ เริ่มงานจัดซื้อ</button>
          <button className="pw-hire-btn" onClick={()=>onStartNew('HIRE')}>+ เริ่มงานจัดจ้าง</button>
          <button onClick={onOpenMaster}>ข้อมูลหลัก</button>
          <button onClick={onOpenArchive}>เอกสารที่จัดเก็บก่อนย้ายระบบ</button>
        </div>
      </header>

      {error&&<p role="alert" className="pw-banner pw-error">{error}</p>}
      {noteMessage&&<p role="status" className="pw-banner pw-info">{noteMessage}</p>}

      <section className="pw-card pw-filter-card" aria-label="ตัวกรองปีงบประมาณและเดือน">
        <div className="pw-filter-row">
          <div className="pw-filter-group" role="group" aria-label="เลือกปีงบประมาณ">
            <span className="pw-filter-label">ปีงบประมาณ</span>
            <button
              type="button"
              className={`pw-binder-filter${yearFilter==='ALL'?' is-active':''}`}
              aria-pressed={yearFilter==='ALL'}
              onClick={()=>{setYearFilter('ALL');setMonthFilter('ALL');}}
            >
              ทุกปีงบ ({cases.length})
            </button>
            {fiscalYears.map(fy=>(
              <button
                key={fy}
                type="button"
                className={`pw-binder-filter${yearFilter===String(fy)?' is-active':''}`}
                aria-pressed={yearFilter===String(fy)}
                onClick={()=>{setYearFilter(String(fy));setMonthFilter('ALL');}}
              >
                ปีงบ {fy}
              </button>
            ))}
          </div>

          <div className="pw-filter-controls">
            <label className="pw-filter-select">
              <span>เดือน</span>
              <select aria-label="กรองตามเดือน" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}>
                <option value="ALL">ทุกเดือน ({yearScoped.length})</option>
                {monthOptions.map(([key,count])=>(
                  <option key={key} value={key}>{formatThaiMonthYear(key)} ({count} งาน)</option>
                ))}
              </select>
            </label>

            <label className="pw-filter-select">
              <span>สถานะ</span>
              <select aria-label="กรองตามสถานะงาน" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as 'ALL'|CaseWorkStatus)}>
                <option value="ALL">ทุกสถานะ</option>
                {WORK_STATUS_LIST.map(s=>(
                  <option key={s.value} value={s.value}>{s.shortLabel}</option>
                ))}
              </select>
            </label>

            <label className="pw-filter-search">
              <span className="pw-sr-only">ค้นหางานจัดซื้อจัดจ้าง</span>
              <input
                type="search"
                aria-label="ค้นหางานจัดซื้อจัดจ้าง"
                placeholder="ค้นหาชื่องาน, ร้านค้า, หมวด หรือโน้ต..."
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
            </label>

            {hasActiveFilter&&(
              <button
                type="button"
                className="pw-filter-reset"
                onClick={()=>{setYearFilter('ALL');setMonthFilter('ALL');setStatusFilter('ALL');setTypeFilter('ALL');setSearch('');}}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="pw-summary-grid" role="group" aria-label="แยกประเภทงานจัดซื้อและจัดจ้าง">
        <button type="button" className={`pw-summary-card${typeFilter==='ALL'?' is-active':''}`} aria-pressed={typeFilter==='ALL'} onClick={()=>setTypeFilter('ALL')}>
          <span>งานทั้งหมด{yearFilter!=='ALL'?` · ปีงบ ${yearFilter}`:''}</span>
          <strong>{periodScoped.length} งาน</strong>
          <small>วงเงินรวม {money(sum(periodScoped))} บาท</small>
        </button>
        <button type="button" className={`pw-summary-card pw-summary-buy${typeFilter==='BUY'?' is-active':''}`} aria-pressed={typeFilter==='BUY'} onClick={()=>setTypeFilter('BUY')}>
          <span>งานจัดซื้อ</span>
          <strong>{buyCases.length} งาน</strong>
          <small>วงเงินรวม {money(sum(buyCases))} บาท</small>
        </button>
        <button type="button" className={`pw-summary-card pw-summary-hire${typeFilter==='HIRE'?' is-active':''}`} aria-pressed={typeFilter==='HIRE'} onClick={()=>setTypeFilter('HIRE')}>
          <span>งานจัดจ้าง</span>
          <strong>{hireCases.length} งาน</strong>
          <small>วงเงินรวม {money(sum(hireCases))} บาท</small>
        </button>
      </div>

      <section className="pw-card pw-register-card">
        <div className="pw-register-head">
          <div>
            <h2>{heading}</h2>
            <p className="pw-hint" style={{margin:'2px 0 0'}}>กดชื่อเรื่องเพื่อเปิดจัดการเอกสาร · กดปุ่ม “จดโน้ต” เพื่ออัปเดตสถานะการจองเลขสมุดคุมหรือสิ่งที่ยังขาดได้ทันทีโดยไม่ต้องเปิดหน้าเอกสาร</p>
          </div>
        </div>

        {groups.length?(
          <div className="pw-register-groups">
            {groups.map(group=>(
              <div key={group.key} className="pw-month-group">
                <div className="pw-month-banner">
                  <strong>{group.label}</strong>
                  <span>{group.cases.length} งาน · รวม {money(sum(group.cases))} บาท</span>
                </div>

                <div className="pw-table-scroll pw-register-scroll">
                  <table className="pw-register-table">
                    <thead>
                      <tr>
                        <th>รายการงาน / คู่ค้า</th>
                        <th className="pw-col-money">วงเงิน (บาท)</th>
                        <th className="pw-col-nums">เลขสมุดคุม</th>
                        <th className="pw-col-status">สถานะงาน</th>
                        <th className="pw-col-note">บันทึกช่วยจำ (Note)</th>
                        <th className="pw-col-actions">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.cases.map(r=>{
                        const hire=r.caseInput.procurementType==='HIRE';
                        const title=r.caseInput.projectTitleShort||r.caseInput.budgetLine.categoryType||(hire?'งานจัดจ้างใหม่ (ยังกรอกไม่ครบ)':'งานจัดซื้อใหม่ (ยังกรอกไม่ครบ)');
                        const budgetTag=[r.caseInput.budgetLine.categoryGroup,r.caseInput.budgetLine.categoryType].filter(Boolean).join(' · ');
                        const progress=summarizeCaseNumbers(r);
                        const statusKey=r.tracker?.status??'RESERVING_NUMBERS';
                        const statusMeta=WORK_STATUS_MAP[statusKey];
                        const noteText=r.tracker?.note?.trim()??'';
                        const isEditing=editingId===r.caseInput.id;
                        const autoMonthKey=deriveCaseMonthKey({...r,tracker:{...(r.tracker??{status:'RESERVING_NUMBERS',workMonth:'',note:''}),workMonth:''}});

                        return (
                          <Fragment key={r.caseInput.id}>
                            <tr className={isEditing?'is-editing':undefined}>
                              <td>
                                <button type="button" className="pw-case-title-btn" onClick={()=>onOpen(r)}>
                                  <span className={`pw-type-badge ${hire?'pw-type-hire':'pw-type-buy'}`}>{hire?'จัดจ้าง':'จัดซื้อ'}</span>
                                  <strong>{title}</strong>
                                </button>
                                <div className="pw-case-sub">
                                  <span>{hire?'ผู้รับจ้าง: ':'ผู้ขาย: '}{r.caseInput.vendor.shopName||(hire?'ยังไม่ระบุผู้รับจ้าง':'ยังไม่ระบุร้าน')}</span>
                                  {budgetTag&&<span>· {budgetTag}</span>}
                                </div>
                              </td>
                              <td className="pw-col-money">
                                <strong>{money(caseAmount(r))}</strong>
                              </td>
                              <td className="pw-col-nums">
                                <span className={`pw-pill ${progress.complete?'pw-num-ok':'pw-num-wait'}`}>
                                  {progress.complete?`ครบ ${progress.filled}/${progress.total}`:`${progress.filled}/${progress.total}`}
                                </span>
                                {!progress.complete&&(
                                  <small className="pw-missing-hint" title={`ยังขาดเลข/วันที่เอกสาร: ${progress.missingDocIds.join(', ')}`}>
                                    ขาด {progress.missingDocIds.slice(0,3).join(', ')}{progress.missingDocIds.length>3?` +${progress.missingDocIds.length-3}`:''}
                                  </small>
                                )}
                              </td>
                              <td className="pw-col-status">
                                <span className={`pw-status-badge pw-status-${statusKey.toLowerCase()}`}>{statusMeta.shortLabel}</span>
                              </td>
                              <td className="pw-col-note">
                                <button
                                  type="button"
                                  className={`pw-note-preview${noteText?' has-note':''}`}
                                  title={noteText||'คลิกเพื่อเพิ่มบันทึกช่วยจำ'}
                                  onClick={()=>openNoteEditor(r)}
                                >
                                  {noteText||'ยังไม่มีโน้ต · คลิกเพื่อจด'}
                                </button>
                              </td>
                              <td className="pw-col-actions">
                                <div className="pw-row pw-row-nowrap">
                                  <button
                                    type="button"
                                    className={`pw-table-btn${isEditing?' is-active':''}`}
                                    aria-expanded={isEditing}
                                    aria-label={`จดโน้ต ${title}`}
                                    onClick={()=>openNoteEditor(r)}
                                  >
                                    <NoteIcon/>
                                    <span>จดโน้ต</span>
                                  </button>
                                  <button type="button" className="pw-table-btn pw-table-open" onClick={()=>onOpen(r)}>
                                    เปิดงาน
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isEditing&&(
                              <tr className="pw-note-editor-row">
                                <td colSpan={6}>
                                  <div className="pw-note-drawer">
                                    <div className="pw-note-drawer-top">
                                      <div className="pw-note-status-group" role="group" aria-label="เลือกสถานะงาน">
                                        <span className="pw-filter-label">สถานะงาน</span>
                                        {WORK_STATUS_LIST.map(item=>(
                                          <button
                                            key={item.value}
                                            type="button"
                                            className={`pw-status-pick pw-status-${item.value.toLowerCase()}${draftStatus===item.value?' is-selected':''}`}
                                            aria-pressed={draftStatus===item.value}
                                            onClick={()=>setDraftStatus(item.value)}
                                          >
                                            {item.label}
                                          </button>
                                        ))}
                                      </div>
                                      <label className="pw-note-month">
                                        <span>เดือนดำเนินงาน</span>
                                        <input
                                          type="month"
                                          aria-label="เดือนที่ดำเนินงาน"
                                          value={draftMonth}
                                          onChange={e=>setDraftMonth(e.target.value)}
                                        />
                                        <small className="pw-muted">
                                          {draftMonth?`แสดงใน ${formatThaiMonthYear(draftMonth)}`:`อัตโนมัติ: ${formatThaiMonthYear(autoMonthKey)}`}
                                        </small>
                                      </label>
                                    </div>

                                    <label className="pw-field">
                                      <span>บันทึกช่วยจำ (Note) · จองเลขถึงไหนแล้ว / ขาดเอกสารหรือข้อมูลอะไร</span>
                                      <textarea
                                        rows={2}
                                        aria-label="บันทึกช่วยจำงาน"
                                        placeholder="เช่น จองเลขบันทึก 1–3 ในสมุดคุมแล้ว รอจองเลข 6.1–10 พรุ่งนี้ และรอใบเสนอราคาคู่เทียบ 2 ร้าน"
                                        value={draftNote}
                                        onChange={e=>setDraftNote(e.target.value)}
                                      />
                                    </label>

                                    <div className="pw-chips" aria-label="ข้อความบันทึกช่วยจำด่วน">
                                      {NOTE_QUICK_CHIPS.map(chip=>(
                                        <button key={chip} type="button" onClick={()=>appendChip(chip)}>+ {chip}</button>
                                      ))}
                                    </div>

                                    <div className="pw-row pw-note-drawer-foot">
                                      <button
                                        type="button"
                                        className="pw-primary"
                                        disabled={busy||savingNote}
                                        onClick={()=>void saveQuickNote(r)}
                                      >
                                        {savingNote?'กำลังบันทึก…':'บันทึกโน้ตและสถานะ'}
                                      </button>
                                      <button type="button" disabled={savingNote} onClick={()=>setEditingId(null)}>ยกเลิก</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ):(
          <div className="pw-empty-list">
            <p>
              {hasActiveFilter
                ? 'ไม่พบงานที่ตรงกับตัวกรองปีงบประมาณ / เดือน / สถานะ หรือคำค้นหาที่เลือก'
                : 'ยังไม่มีงานในแบบฟอร์มชุดใหม่ · งานที่ทำไว้ก่อนหน้านี้เปิดได้จาก “เอกสารที่จัดเก็บก่อนย้ายระบบ”'}
            </p>
            <div className="pw-row">
              {hasActiveFilter&&<button type="button" onClick={()=>{setYearFilter('ALL');setMonthFilter('ALL');setStatusFilter('ALL');setTypeFilter('ALL');setSearch('');}}>แสดงงานทั้งหมด</button>}
              <button type="button" className="pw-primary" onClick={()=>onStartNew('BUY')}>+ เริ่มงานจัดซื้อใหม่</button>
              <button type="button" className="pw-hire-btn" onClick={()=>onStartNew('HIRE')}>+ เริ่มงานจัดจ้างใหม่</button>
            </div>
          </div>
        )}
      </section>

      <details className="pw-card">
        <summary>ทดลองข้อมูลตัวอย่าง (ไม่ใช่ข้อมูลจริง)</summary>
        <p>เมื่อเปิดจะสร้างงานตัวอย่างแยกให้ และบันทึกลงฐานข้อมูลเดียวกับงานของคุณ สามารถลบภายหลังได้</p>
        <div className="pw-row">
          <button onClick={()=>onOpenSample('1520')}>เปิดตัวอย่างจัดซื้อ 1,520 บาท · 2 รายการ</button>
          <button onClick={()=>onOpenSample('22890')}>เปิดตัวอย่างจัดซื้อ 22,890 บาท · 7 รายการ</button>
          <button onClick={()=>onOpenSample('hire')}>เปิดตัวอย่างจัดจ้าง 3,500 บาท · จ้างเหมาซ่อมแซม</button>
        </div>
      </details>

      {children}
    </div>
  );
}
