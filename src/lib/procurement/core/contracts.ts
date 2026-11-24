import {contractStatus,type ContractDate} from '../../procurement-contracts';
import {calculateDraftAmounts} from '../calculations';
import {calculateDeliveryDueDate} from '../holidays';
import {formatDocumentNumbers} from '../numbering';
import {toThaiDigits} from '../formatting';
import type {StoredCase} from '../workspace/model';
import {today} from '../../document';
export function coreContractDates(records:StoredCase[],asOf=today()):ContractDate[]{
  return records.filter(record=>!record.caseInput.projectTitleShort?.startsWith('[ตัวอย่าง]')).flatMap(record=>{
    const c=record.caseInput,date=c.docs.doc10_purchaseOrder.date;
    if(!date)return [];
    const due=calculateDeliveryDueDate(date,c.deliveryDays).effectiveDueDate;
    const done=!!c.inspectionResult.deliveryDate&&c.inspectionResult.deliveryDate<=asOf&&c.inspectionResult.isCorrect&&c.inspectionResult.isComplete;
    const title=c.projectTitleShort||c.budgetLine.categoryType||'งานจัดซื้อจัดจ้าง';
    return [{id:'core-contract:'+c.id,caseId:c.id,taskId:'',date:due,title:'ครบกำหนดสัญญา · '+title,caseTitle:title,vendor:c.vendor.shopName,number:formatDocumentNumbers(c.docs,record.agency).doc10_purchaseOrder,amount:toThaiDigits(calculateDraftAmounts(c.items,c.vendor.isVatRegistered).grandTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})),owner:c.signatories.procurementOfficer.fullName,done,status:contractStatus(due,done,false,asOf),waiting:[],url:'/?view=procurement&coreCase='+encodeURIComponent(c.id)+'&tab=timeline'}];
  });
}
