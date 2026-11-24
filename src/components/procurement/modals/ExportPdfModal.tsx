import {useState} from 'react';
import type {PdfBinderOptions, PdfExportProfile} from '@/lib/procurement/exporters/profiles';
import type {ExternalDocSlot, ExternalFile, StoredCase} from '@/lib/procurement/workspace/model';
import {Check} from '../fields';
import {Dialog} from './Dialog';
export function ExportPdfModal({defaults,docId,externalFiles=[],onClose,onExport}:{defaults:StoredCase['pdfDefaults'];docId:ExternalDocSlot;externalFiles?:readonly ExternalFile[];onClose:()=>void;onExport:(options:PdfBinderOptions)=>void}){
 const [mode,setMode]=useState<'FULL_BINDER'|'BY_STAGE'|'SINGLE_DOC'>('FULL_BINDER'),[stage,setStage]=useState('STAGE_1_PRINCIPLE'),[options,setOptions]=useState({...defaults,includeExternalFiles:defaults.includeExternalFiles??true});
 const included=externalFiles.filter(f=>f.includeInExport),extPages=included.reduce((n,f)=>n+f.pages,0),extSlots=new Set(included.map(f=>f.slotId)).size;
 const slotLabel=docId==='OTHER'?'อื่นๆ (หลักฐานเพิ่มเติม)':`เอกสาร ${docId}`;
 return <Dialog title="ส่งออก PDF พร้อมพิมพ์" onClose={onClose}><fieldset><legend>ชุดเอกสาร</legend>{([['FULL_BINDER','รวมทั้งแฟ้มเรียงตามลำดับ (ระบบสร้าง + ไฟล์หลักฐานภายนอก)'],['BY_STAGE','แยกพิมพ์ตามรอบเสนอแฟ้ม'],['SINGLE_DOC',`เฉพาะช่องที่กำลังเปิดดู (${slotLabel})`]] as const).map(([key,label])=><label className="pw-check" key={key}><input type="radio" name="pdf-profile" value={key} checked={mode===key} onChange={()=>setMode(key)}/>{label}</label>)}{mode==='BY_STAGE'&&<select aria-label="รอบเสนอแฟ้ม" value={stage} onChange={e=>setStage(e.target.value)}>{['หลักการและ TOR','สั่งซื้อและสัญญา','ตรวจรับและตั้งหนี้','วางฎีกา'].map((label,i)=><option key={label} value={['STAGE_1_PRINCIPLE','STAGE_2_ORDER','STAGE_3_INSPECTION','STAGE_4_DISBURSEMENT'][i]}>รอบ {i+1} · {label}</option>)}</select>}</fieldset>
 <Check label={`รวมไฟล์หลักฐานภายนอกที่อัปโหลด (e-LAAS / ใบเสนอราคา / อื่นๆ) เข้าเป็นชุดเดียวกัน${included.length?` — พบ ${included.length} ไฟล์ (${extPages} หน้า จาก ${extSlots} ช่อง)`:' — ยังไม่มีไฟล์ที่อัปโหลด'}`} checked={options.includeExternalFiles} onChange={v=>setOptions(o=>({...o,includeExternalFiles:v}))}/>
 <Check label="เบิ้ลจำนวนชุดอัตโนมัติ" checked={options.duplicateCopies} onChange={v=>setOptions(o=>({...o,duplicateCopies:v}))}/>
 <Check label={options.includeExternalFiles?'แทรกแผ่นคั่นเฉพาะช่องภายนอกที่ยังไม่ได้อัปโหลดไฟล์':'แทรกแผ่นคั่นเอกสาร LAAS / e-GP / ร้านค้า'} checked={options.includeDividers} onChange={v=>setOptions(o=>({...o,includeDividers:v}))}/>
 <Check label="แนบใบปะหน้า Checklist" checked={options.includeCoverChecklist} onChange={v=>setOptions(o=>({...o,includeCoverChecklist:v}))}/>
 <p className="pw-muted">ใช้รูปแบบจากร่าง Core ที่บันทึกไว้ รวม Text Box และไฟล์แนบ โดยแทรกเอกสารภายนอกที่อัปโหลดตรงตำแหน่งในแฟ้มอัตโนมัติ</p><p className="pw-muted">บันทึกตัวเลือกเหล่านี้เป็นค่าเริ่มต้นของงานนี้อัตโนมัติ</p><button className="pw-primary" onClick={()=>{const profile:PdfExportProfile=mode==='FULL_BINDER'?{mode}:mode==='SINGLE_DOC'?{mode,docId}:{mode,stage:stage as 'STAGE_1_PRINCIPLE'};onExport({...options,profile});}}>ดาวน์โหลด PDF</button></Dialog>;
}
