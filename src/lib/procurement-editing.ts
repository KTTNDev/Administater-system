import type {ProcurementInput} from './procurement';
/** Future drafts may be prepared; confirmation of round two still waits for finance's return. */
export function canEditProcurementDocument(data:ProcurementInput,code:string){return data.workflow.state==='preparing'&&code!=='V01'||data.workflow.state==='returned_for_voucher'&&['D14','V01'].includes(code);}
export function assertProcurementDocumentEditable(data:ProcurementInput,code:string){if(!canEditProcurementDocument(data,code))throw Error('ชุดตั้งหนี้ตรึงไว้แล้ว รับเอกสารกลับจากคลังก่อนจัดทำบันทึกขอเบิกและฎีกา หรือเปิดแก้ไขพร้อมเหตุผล');}
