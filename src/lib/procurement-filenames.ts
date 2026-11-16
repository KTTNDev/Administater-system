import {billValues,minor,formatMoney} from './procurement-bill';
import type {ProcurementInput} from './procurement';
import {procurementDocumentNames} from './procurement-document-types';
export function filenamePart(value:string,max=115){return value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').slice(0,max).replace(/[\uD800-\uDBFF]$/,'').replace(/[. ]+$/g,'')||'เอกสาร';}
export function procurementFilename(data:ProcurementInput,title:string,version:number,extension:'docx'|'pdf'|'zip'){
 const value=billValues(data).agreed,amount=value&&/^\d[\d,]*(?:\.\d{1,2})?$/.test(value)?formatMoney(minor(value)):'ยังไม่ระบุยอด';return filenamePart(amount,25)+(value?'บาท':'')+'_'+filenamePart(title)+(version?'_ฉบับ'+version:'')+'.'+extension;
}
export function procurementBundleName(data:ProcurementInput,extension:'pdf'|'zip',round?:number){return procurementFilename(data,(round?'ชุดส่งคลังรอบ'+round:'ชุดเอกสาร'+(data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง'))+'_'+data.title,0,extension);}
export function procurementFolder(code:keyof typeof procurementDocumentNames){return filenamePart(procurementDocumentNames[code],90);}
export function procurementDownloadHeader(name:string){return 'attachment; filename="document.'+(name.split('.').at(-1)||'zip')+'"; filename*=UTF-8\'\''+encodeURIComponent(name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());}
