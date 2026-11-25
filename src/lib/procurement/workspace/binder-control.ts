import type {AgencyConfig} from '../types';
import {TIMELINE,type DraftCase} from './model';
import {THAI_MONTHS_SHORT} from './tracker';

export function formatThaiShortDate(iso?:string|null):string|null{
  if(!iso)return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if(!match)return null;
  const yearBE=Number(match[1])+543,monthIdx=Number(match[2])-1,day=Number(match[3]);
  if(monthIdx<0||monthIdx>11||day<1||day>31)return null;
  return `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${yearBE}`;
}

export type BinderControlStatus='COMPLETE'|'MISSING_NUMBER'|'MISSING_DATE'|'MISSING_BOTH'|'INHERITED'|'OPTIONAL';

export interface BinderDocControl{
  hasOwnNumber:boolean;
  required:boolean;
  needsAttention:boolean;
  numberText:string|null;
  dateText:string|null;
  missingNumberLabel:string|null;
  missingDateLabel:string|null;
  contextNote:string|null;
  status:BinderControlStatus;
  jumpField:string|null;
}

const TIMELINE_BY_ID=new Map<string,(typeof TIMELINE)[number]>(TIMELINE.map(row=>[row[0],row]));

export function getBinderDocControl(
  docId:string,
  input:DraftCase,
  agency:AgencyConfig,
  source:string,
):BinderDocControl{
  const docs=input.docs;
  const timelineRow=TIMELINE_BY_ID.get(docId);

  if(timelineRow){
    const [,key]=timelineRow;
    const entry=docs[key];
    const dateText=formatThaiShortDate(entry.date);
    const isGenerated=source==='GENERATED';
    const required=isGenerated||docId==='6.2'||docId==='10';

    let numberText:string|null=null;
    let missingNumberLabel:string|null=null;
    let missingDateLabel='ยังไม่ลงวันที่';
    let jumpNumberField=`docs.${key}.runningNo`;

    if(key==='doc6_2_inspectorOrder'){
      const num=docs.doc6_2_inspectorOrder.runningNo?.trim();
      const year=docs.doc6_2_inspectorOrder.yearBE;
      missingDateLabel='ยังไม่ลงวันที่สั่ง';
      if(num&&year)numberText=`คำสั่ง ${num}/${year}`;
      else if(num){
        numberText=`คำสั่ง ${num}/?`;
        missingNumberLabel='ยังไม่ระบุปี พ.ศ.';
        jumpNumberField='docs.doc6_2_inspectorOrder.yearBE';
      }else{
        missingNumberLabel='ยังไม่จองเลขคำสั่ง';
      }
    }else if(key==='doc8_winnerAnnouncement'){
      const logNo=docs.doc8_winnerAnnouncement.registryLogNo?.trim();
      missingDateLabel='ยังไม่ลงวันที่ประกาศ';
      jumpNumberField='docs.doc8_winnerAnnouncement.registryLogNo';
      if(logNo)numberText=`ทะเบียนประกาศ ${logNo}`;
      else missingNumberLabel='ยังไม่จองเลขประกาศ';
    }else if(key==='doc9_contractNotice'){
      const num=docs.doc9_contractNotice.runningNo?.trim();
      if(num)numberText=`ที่ ${agency.codes.externalLetterPrefix}/${num}`;
      else missingNumberLabel='ยังไม่จองเลขภายนอก';
    }else if(key==='doc10_purchaseOrder'){
      const num=docs.doc10_purchaseOrder.runningNo?.trim();
      const fy=docs.doc10_purchaseOrder.fiscalYearBE;
      missingDateLabel='ยังไม่ลงวันที่ใบสั่ง';
      if(num&&fy)numberText=`${agency.codes.poPrefix} ${num}/${fy}`;
      else if(num){
        numberText=`${agency.codes.poPrefix} ${num}/?`;
        missingNumberLabel='ยังไม่ระบุปีงบใบสั่ง';
        jumpNumberField='docs.doc10_purchaseOrder.fiscalYearBE';
      }else{
        missingNumberLabel='ยังไม่จองเลขใบสั่ง';
      }
    }else{
      const num='runningNo' in entry?entry.runningNo?.trim():undefined;
      if(num)numberText=`ที่ ${agency.codes.internalMemoPrefix}/${num}`;
      else missingNumberLabel='ยังไม่จองเลขบันทึก';
    }

    const hasNum=!missingNumberLabel&&!!numberText;
    const hasDate=!!dateText;
    const status:BinderControlStatus=hasNum&&hasDate
      ?'COMPLETE'
      :!hasNum&&!hasDate
        ?'MISSING_BOTH'
        :!hasNum
          ?'MISSING_NUMBER'
          :'MISSING_DATE';

    const jumpField=!hasNum?jumpNumberField:`docs.${key}.date`;
    const contextNote=!required&&!hasNum&&!hasDate?'ออกเอกสารในระบบ e-GP':null;
    return {
      hasOwnNumber:true,
      required,
      needsAttention:required&&status!=='COMPLETE',
      numberText,
      dateText,
      missingNumberLabel:hasNum?null:missingNumberLabel,
      missingDateLabel:hasDate?null:missingDateLabel,
      contextNote,
      status:required||hasNum||hasDate?status:'OPTIONAL',
      jumpField,
    };
  }

  if(docId==='4.1'){
    const dateText=formatThaiShortDate(docs.doc3_reportSpec.date);
    return {
      hasOwnNumber:false,
      required:false,
      needsAttention:false,
      numberText:null,
      dateText,
      missingNumberLabel:null,
      missingDateLabel:dateText?null:'รอวันที่เอกสาร 3',
      contextNote:'ไม่ใช้เลขคุม · อิงเอกสาร 3',
      status:dateText?'INHERITED':'MISSING_DATE',
      jumpField:'docs.doc3_reportSpec.date',
    };
  }

  if(docId==='11.2'||docId==='11.3'){
    const dateText=formatThaiShortDate(docs.doc11_1_inspectionReport.date);
    const ctrl=docId==='11.2'?docs.inspectionControlNo?.trim()||null:null;
    return {
      hasOwnNumber:false,
      required:false,
      needsAttention:false,
      numberText:ctrl?`เลขคุมตรวจรับ ${ctrl}`:null,
      dateText,
      missingNumberLabel:null,
      missingDateLabel:dateText?null:'รอวันที่ตรวจรับ 11.1',
      contextNote:ctrl?null:'ไม่ใช้เลขคุม · อิงตรวจรับ 11.1',
      status:dateText?'INHERITED':'MISSING_DATE',
      jumpField:ctrl?'docs.inspectionControlNo':'docs.doc11_1_inspectionReport.date',
    };
  }

  if(docId==='5.1'||docId==='5.2'){
    const num=docId==='5.1'?docs.laasPurchaseReportNo?.trim():docs.laasContractNo?.trim();
    const dateText=formatThaiShortDate(docs.laasDate);
    return {
      hasOwnNumber:true,
      required:false,
      needsAttention:false,
      numberText:num?(docId==='5.1'?(/^laas/i.test(num)?num:`LAAS ${num}`):(/^สัญญา/.test(num)?num:`สัญญา ${num}`)):null,
      dateText,
      missingNumberLabel:num?null:(docId==='5.1'?'ยังไม่กรอกเลข LAAS':'ยังไม่กรอกเลขสัญญา LAAS'),
      missingDateLabel:dateText?null:'ยังไม่ลงวันที่ LAAS',
      contextNote:null,
      status:num&&dateText?'COMPLETE':'OPTIONAL',
      jumpField:num?'docs.laasDate':(docId==='5.1'?'docs.laasPurchaseReportNo':'docs.laasContractNo'),
    };
  }

  if(docId==='11.4'){
    const dateText=formatThaiShortDate(input.inspectionResult.deliveryDate);
    return {
      hasOwnNumber:false,
      required:false,
      needsAttention:false,
      numberText:null,
      dateText,
      missingNumberLabel:null,
      missingDateLabel:dateText?null:'ยังไม่กรอกวันส่งมอบ',
      contextNote:'วันส่งมอบจริง',
      status:dateText?'INHERITED':'OPTIONAL',
      jumpField:'inspectionResult.deliveryDate',
    };
  }

  if(docId==='4.2'||docId==='11.5'){
    const dateText=formatThaiShortDate(docs.doc3_reportSpec.date);
    return {
      hasOwnNumber:false,
      required:false,
      needsAttention:false,
      numberText:null,
      dateText,
      missingNumberLabel:null,
      missingDateLabel:dateText?null:'รอวันที่เอกสาร 3',
      contextNote:'ประทับวันที่ตามเอกสาร 3',
      status:dateText?'INHERITED':'OPTIONAL',
      jumpField:'docs.doc3_reportSpec.date',
    };
  }

  if(docId==='14'){
    const dateText=formatThaiShortDate(docs.doc13_disbursement.date);
    return {
      hasOwnNumber:false,
      required:false,
      needsAttention:false,
      numberText:null,
      dateText,
      missingNumberLabel:null,
      missingDateLabel:dateText?null:'อ้างอิงวันขอเบิก 13',
      contextNote:'อัปโหลดฎีกาจาก e-LAAS',
      status:'OPTIONAL',
      jumpField:'docs.doc13_disbursement.date',
    };
  }

  return {
    hasOwnNumber:false,
    required:false,
    needsAttention:false,
    numberText:null,
    dateText:null,
    missingNumberLabel:null,
    missingDateLabel:null,
    contextNote:null,
    status:'OPTIONAL',
    jumpField:null,
  };
}
