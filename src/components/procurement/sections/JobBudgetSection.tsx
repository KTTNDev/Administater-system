
import {BudgetTaxonomyField} from '@/components/budget-taxonomy-field';
import {categoryOptionGroups,planOptionGroups,shouldResetTypeForCategory,shouldResetWorkForPlan,typeOptionGroups,workOptionGroups} from '@/lib/budget-taxonomy';
import {defaultCaseTracker,defaultPurposeForType,type CaseWorkStatus} from '@/lib/procurement/workspace/model';
import {deriveCaseMonthKey,formatThaiMonthYear,NOTE_QUICK_CHIPS,summarizeCaseNumbers,WORK_STATUS_LIST} from '@/lib/procurement/workspace/tracker';
import {Field,formAmounts,money,type EditorProps} from '../fields';
export function JobBudgetSection({record,master,update}:EditorProps){
  const d=record.caseInput,b=d.budgetLine,hire=d.procurementType==='HIRE',division=record.agency.divisionName,total=formAmounts(d.items,d.vendor.isVatRegistered).grandTotal,allocated=b.allocatedAmount+b.transferInAmount-b.transferOutAmount,before=allocated-d.budgetSpentBefore;
  const purposePresets=hire
    ? [
        `เพื่อให้การดำเนินงานและบำรุงรักษาทรัพย์สินของ${division} เป็นไปด้วยความเรียบร้อย`,
        `เพื่อซ่อมแซมบำรุงรักษาครุภัณฑ์ของ${division} ให้สามารถใช้งานได้ตามปกติ`,
        `เพื่อจัดจ้างเหมาบริการสนับสนุนการปฏิบัติงานและให้บริการประชาชนของ${division}`,
      ]
    : [
        `เพื่อใช้ในการปฏิบัติงานและให้บริการประชาชนของ${division}`,
        `เพื่อจัดหาวัสดุสำหรับใช้ในภารกิจประจำของ${division}`,
        `เพื่อจัดหาครุภัณฑ์สนับสนุนการปฏิบัติงานของ${division}`,
      ];
  function switchType(nextType:'BUY'|'HIRE'){
    if(nextType===d.procurementType)return;
    update(n=>{
      const prev=n.caseInput.procurementType;
      n.caseInput.procurementType=nextType;
      n.caseInput.penaltyRatePercent=nextType==='BUY'?.2:.1;
      const oldDefaultPurpose=defaultPurposeForType(prev,n.agency.divisionName);
      if(!n.caseInput.purposeText.trim()||n.caseInput.purposeText.trim()===oldDefaultPurpose)n.caseInput.purposeText=defaultPurposeForType(nextType,n.agency.divisionName);
      if(n.caseInput.budgetLine.allocatedAmount===0){
        if(nextType==='HIRE'&&(!n.caseInput.budgetLine.categoryGroup||n.caseInput.budgetLine.categoryGroup==='ค่าวัสดุ')){n.caseInput.budgetLine.categoryGroup='ค่าใช้สอย';if(!n.caseInput.budgetLine.categoryType)n.caseInput.budgetLine.categoryType='รายจ่ายเพื่อให้ได้มาซึ่งบริการ';}
        else if(nextType==='BUY'&&(!n.caseInput.budgetLine.categoryGroup||n.caseInput.budgetLine.categoryGroup==='ค่าใช้สอย')){n.caseInput.budgetLine.categoryGroup='ค่าวัสดุ';if(n.caseInput.budgetLine.categoryType==='รายจ่ายเพื่อให้ได้มาซึ่งบริการ')n.caseInput.budgetLine.categoryType='';}
      }
      if(n.caseInput.items.length===1&&!n.caseInput.items[0].description.trim()&&['','ชิ้น','งาน'].includes(n.caseInput.items[0].unit))n.caseInput.items[0].unit=nextType==='BUY'?'ชิ้น':'งาน';
    });
  }
  return <section className="pw-card" id="pw-section-job"><h2>1 · งานและงบประมาณ</h2><div className="pw-grid">
    <div className="pw-field pw-wide"><span>ประเภทงาน (กำหนดถ้อยคำและเงื่อนไขเอกสารทั้งชุด)</span><div className="pw-type-switch" role="group" aria-label="ประเภทงาน">
      <button type="button" className={`pw-type-option${!hire?' is-buy':''}`} aria-pressed={!hire} onClick={()=>switchType('BUY')}><strong>งานจัดซื้อ</strong><small>ซื้อสินค้า วัสดุ ครุภัณฑ์ · ใบสั่งซื้อ · ค่าปรับ ๐.๒๐%</small></button>
      <button type="button" className={`pw-type-option${hire?' is-hire':''}`} aria-pressed={hire} onClick={()=>switchType('HIRE')}><strong>งานจัดจ้าง</strong><small>จ้างเหมาบริการ ซ่อมแซม ก่อสร้าง · ใบสั่งจ้าง · ค่าปรับ ๐.๑๐%</small></button>
    </div></div>
    <Field path="projectTitleShort" label="ชื่อเรื่องย่อ" value={d.projectTitleShort??''} example={hire?'จ้างเหมาซ่อมแซมเครื่องปรับอากาศ':'วัสดุสำนักงาน'} onChange={v=>update(n=>{n.caseInput.projectTitleShort=v;})}/>
    <label className="pw-field">เลือกงบประมาณที่บันทึกไว้<select aria-label="เลือกงบประมาณ" value={master.budgetLines.some(v=>v.id===b.id)?b.id:''} onChange={e=>{const selected=master.budgetLines.find(v=>v.id===e.target.value);if(selected)update(n=>{n.caseInput.budgetLine=structuredClone(selected);});}}><option value="">กรอกเอง หรือเลือกงบประมาณ</option>{master.budgetLines.map(v=><option key={v.id} value={v.id}>{v.fiscalYearBE} · {v.categoryType} · {v.planName}</option>)}</select></label>
    <Field path="budgetLine.fiscalYearBE" label="ปีงบประมาณ พ.ศ." value={b.fiscalYearBE} example="2570" type="number" onChange={v=>update(n=>{n.caseInput.budgetLine.fiscalYearBE=Number(v);})}/>
    <BudgetTaxonomyField className="pw-field" id="pw-budgetLine.planName" name="budgetLine.planName" label="แผนงาน" value={b.planName} placeholder="เลือกหรือพิมพ์แผนงาน (เช่น แผนงานสังคมสงเคราะห์)" groups={planOptionGroups()} onChange={v=>update(n=>{n.caseInput.budgetLine.planName=v;})} onSelect={v=>update(n=>{n.caseInput.budgetLine.planName=v;if(shouldResetWorkForPlan(v,n.caseInput.budgetLine.workName))n.caseInput.budgetLine.workName='';})}/>
    <BudgetTaxonomyField className="pw-field" id="pw-budgetLine.workName" name="budgetLine.workName" label="งาน" value={b.workName} placeholder="เลือกหรือพิมพ์งานตามแผนงาน" groups={workOptionGroups(b.planName)} onChange={v=>update(n=>{n.caseInput.budgetLine.workName=v;})}/>
    <BudgetTaxonomyField className="pw-field" id="pw-budgetLine.categoryGroup" name="budgetLine.categoryGroup" label="หมวดรายจ่าย" value={b.categoryGroup} placeholder={hire?'เลือกหรือพิมพ์หมวดรายจ่าย (เช่น ค่าใช้สอย)':'เลือกหรือพิมพ์หมวดรายจ่าย (เช่น ค่าวัสดุ)'} groups={categoryOptionGroups()} onChange={v=>update(n=>{n.caseInput.budgetLine.categoryGroup=v;})} onSelect={v=>update(n=>{n.caseInput.budgetLine.categoryGroup=v;if(shouldResetTypeForCategory(v,n.caseInput.budgetLine.categoryType))n.caseInput.budgetLine.categoryType='';})}/>
    <BudgetTaxonomyField className="pw-field" id="pw-budgetLine.categoryType" name="budgetLine.categoryType" label="ประเภทรายจ่าย" value={b.categoryType} placeholder={hire?'เลือกหรือพิมพ์ประเภทรายจ่าย (เช่น รายจ่ายเพื่อให้ได้มาซึ่งบริการ)':'เลือกหรือพิมพ์ประเภทรายจ่าย (เช่น วัสดุสำนักงาน)'} groups={typeOptionGroups(b.categoryGroup)} onChange={v=>update(n=>{n.caseInput.budgetLine.categoryType=v;})}/>
    {([['allocatedAmount','งบตั้งไว้ (บาท)','300000'],['transferInAmount','โอนเพิ่ม (บาท)','0'],['transferOutAmount','โอนลด (บาท)','0']] as const).map(([key,label,example])=><Field key={key} path={'budgetLine.'+key} label={label} value={b[key]} example={example} type="number" onChange={v=>update(n=>{n.caseInput.budgetLine[key]=Number(v);})}/>)}
    <Field path="budgetSpentBefore" label="เบิกแล้วก่อนรายการนี้ (บาท)" value={d.budgetSpentBefore} type="number" example="1000" onChange={v=>update(n=>{n.caseInput.budgetSpentBefore=Number(v);})}/>
    <div className="pw-field pw-wide"><label htmlFor="pw-purposeText"><span>เหตุผล / ความจำเป็น</span></label><textarea id="pw-purposeText" value={d.purposeText} placeholder={hire?'ตัวอย่าง: เพื่อซ่อมแซมบำรุงรักษาทรัพย์สินให้ใช้งานได้ตามปกติ…':'ตัวอย่าง: เพื่อใช้ในการปฏิบัติงานของกอง… (กรอกเหตุผลจริง)'} rows={3} onChange={e=>update(n=>{n.caseInput.purposeText=e.target.value;})}/><div className="pw-chips" aria-label="ข้อความเหตุผลสำเร็จรูป">{purposePresets.map(text=><button key={text} type="button" onClick={()=>update(n=>{n.caseInput.purposeText=text;})}>{text.length>46?text.slice(0,46)+'…':text}</button>)}</div></div>
  </div>
  {(()=>{const tracker=record.tracker??defaultCaseTracker(),nums=summarizeCaseNumbers(record),autoMonth=deriveCaseMonthKey({...record,tracker:{...tracker,workMonth:''}});return <fieldset className="pw-tracker-box"><legend>ติดตามงาน &amp; บันทึกช่วยจำ (สมุดคุมเลขมือ · ไม่พิมพ์ลงเอกสาร)</legend><div className="pw-grid">
    <label className="pw-field"><span>สถานะงานปัจจุบัน</span><select aria-label="สถานะงานปัจจุบัน" value={tracker.status} onChange={e=>update(n=>{n.tracker={...(n.tracker??defaultCaseTracker()),status:e.target.value as CaseWorkStatus};})}>{WORK_STATUS_LIST.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select><small className="pw-muted">เลข/วันที่เอกสารในระบบตอนนี้: {nums.complete?`ครบ ${nums.filled}/${nums.total} ฉบับ`:`${nums.filled}/${nums.total} ฉบับ (ขาด ${nums.missingDocIds.join(', ')})`}</small></label>
    <label className="pw-field"><span>เดือนที่ดำเนินงาน (ใช้จัดกลุ่มในหน้าทะเบียนงาน)</span><input type="month" aria-label="เดือนที่ดำเนินงาน" value={tracker.workMonth} onChange={e=>update(n=>{n.tracker={...(n.tracker??defaultCaseTracker()),workMonth:e.target.value};})}/><small className="pw-muted">{tracker.workMonth?`แสดงในกลุ่ม ${formatThaiMonthYear(tracker.workMonth)}`:`เว้นว่าง = ใช้วันที่เอกสารอัตโนมัติ (${formatThaiMonthYear(autoMonth)})`}</small></label>
    <div className="pw-field pw-wide"><label htmlFor="pw-tracker-note"><span>บันทึกช่วยจำ (Note) · จองเลขถึงไหนแล้ว / ขาดอะไร</span></label><textarea id="pw-tracker-note" rows={2} value={tracker.note} placeholder="เช่น จองเลขบันทึก 1–3 ในสมุดคุมแล้ว รอจองเลขคำสั่ง 6.2 พรุ่งนี้ และรอใบเสนอราคาคู่เทียบ 2 ร้าน" onChange={e=>update(n=>{n.tracker={...(n.tracker??defaultCaseTracker()),note:e.target.value};})}/><div className="pw-chips" aria-label="ข้อความบันทึกช่วยจำด่วนในฟอร์ม">{NOTE_QUICK_CHIPS.map(chip=><button key={chip} type="button" onClick={()=>update(n=>{const cur=n.tracker??defaultCaseTracker(),prev=cur.note.trim();n.tracker={...cur,note:!prev?chip:prev.includes(chip)?prev:`${prev} · ${chip}`};})}>+ {chip}</button>)}</div></div>
  </div></fieldset>;})()}
  <dl className="pw-ledger" aria-label="สรุปงบประมาณ">{[['ตั้งไว้',allocated],['เบิกแล้ว',d.budgetSpentBefore],['คงเหลือก่อนเบิก',before],['ขอเบิกครั้งนี้',total],['คงเหลือยกไป',before-total]].map(([label,value])=><div key={label} className={Number(value)<0?'pw-error':''}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl>
  <details><summary>ตัวเลือกขั้นสูง · แนวทางดำเนินงาน</summary><label className="pw-field">แนวทาง<select value={d.workflowModeOverride} onChange={e=>update(n=>{n.caseInput.workflowModeOverride=e.target.value as typeof d.workflowModeOverride;})}><option value="AUTO">อัตโนมัติตามวงเงิน</option><option value="MANUAL_UNDER_5000">พิมพ์มือครบชุด (ยืนยันเอง)</option><option value="EGP_OVER_5000">e-GP (ยืนยันเอง)</option></select></label></details></section>;
}
