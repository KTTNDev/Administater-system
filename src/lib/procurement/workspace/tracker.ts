import {TIMELINE,type CaseWorkStatus,type StoredCase} from './model';

export const THAI_MONTHS_FULL=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'] as const;
export const THAI_MONTHS_SHORT=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'] as const;
/** Thai government fiscal year order: October (10) -> September (09). */
export const FISCAL_MONTH_ORDER=['10','11','12','01','02','03','04','05','06','07','08','09'] as const;

export const WORK_STATUS_LIST:readonly {
  value:CaseWorkStatus;
  label:string;
  shortLabel:string;
  hint:string;
}[]=[
  {value:'RESERVING_NUMBERS',label:'จองเลขสมุดคุม / รอข้อมูล',shortLabel:'จองเลข/รอข้อมูล',hint:'กำลังทยอยออกเลขในสมุดคุมมือจริง หรือรอเอกสารประกอบ'},
  {value:'READY_TO_GENERATE',label:'ได้เลขครบ พร้อมทำในระบบ',shortLabel:'พร้อมทำในระบบ',hint:'จองเลขและวันที่ครบแล้ว พร้อมกรอกและสร้างชุดเอกสารรวดเดียว'},
  {value:'DRAFTED',label:'สร้างเอกสารแล้ว / รอเสนอเซ็น',shortLabel:'สร้างร่างแล้ว',hint:'สร้างชุดร่างเอกสารในระบบแล้ว อยู่ระหว่างตรวจ/เสนอเซ็น'},
  {value:'COMPLETED',label:'ตรวจรับ / เบิกจ่ายเสร็จสิ้น',shortLabel:'เสร็จสิ้น',hint:'ส่งตรวจรับและเบิกจ่ายเรียบร้อยแล้ว'},
];

export const WORK_STATUS_MAP:Record<CaseWorkStatus,(typeof WORK_STATUS_LIST)[number]>=Object.fromEntries(
  WORK_STATUS_LIST.map(item=>[item.value,item]),
) as Record<CaseWorkStatus,(typeof WORK_STATUS_LIST)[number]>;

export const NOTE_QUICK_CHIPS=[
  'จองเลข 1–3 แล้ว',
  'รอจองเลข 6.1–10 ในสมุดคุม',
  'รอใบเสนอราคาคู่เทียบ 2 ร้าน',
  'รอส่งมอบ / รูปตรวจรับ',
  'ได้เลขครบแล้ว พร้อมทำชุดเอกสาร',
] as const;

export function fiscalYearFromMonthKey(monthKey:string):number|null{
  const match=/^(\d{4})-(\d{2})$/.exec(monthKey);
  if(!match)return null;
  const yearAD=Number(match[1]),month=Number(match[2]);
  if(month<1||month>12)return null;
  return yearAD+543+(month>=10?1:0);
}

export function deriveCaseMonthKey(record:StoredCase):string{
  const explicit=record.tracker?.workMonth?.trim();
  if(explicit&&/^\d{4}-\d{2}$/.test(explicit))return explicit;
  const docs=record.caseInput.docs;
  const candidates=[
    docs.doc1_approvePrinciple?.date,
    docs.doc6_1_purchaseRequest?.date,
    docs.doc10_purchaseOrder?.date,
    docs.doc11_1_inspectionReport?.date,
    docs.doc13_disbursement?.date,
    record.updatedAt?.slice(0,10),
  ];
  for(const raw of candidates){
    if(raw&&/^\d{4}-\d{2}/.test(raw))return raw.slice(0,7);
  }
  return '';
}

export function deriveCaseFiscalYear(record:StoredCase):number{
  const fromBudget=record.caseInput.budgetLine.fiscalYearBE;
  if(Number.isFinite(fromBudget)&&fromBudget>=2500)return fromBudget;
  const monthKey=deriveCaseMonthKey(record);
  const fromMonth=fiscalYearFromMonthKey(monthKey);
  if(fromMonth)return fromMonth;
  const now=new Date();
  return now.getFullYear()+543+(now.getMonth()>=9?1:0);
}

export function formatThaiMonthYear(monthKey:string,short=false):string{
  const match=/^(\d{4})-(\d{2})$/.exec(monthKey);
  if(!match)return 'ยังไม่ระบุเดือน';
  const yearBE=Number(match[1])+543,monthIdx=Number(match[2])-1;
  if(monthIdx<0||monthIdx>11)return 'ยังไม่ระบุเดือน';
  return short?`${THAI_MONTHS_SHORT[monthIdx]} ${String(yearBE).slice(-2)}`:`${THAI_MONTHS_FULL[monthIdx]} ${yearBE}`;
}

export interface CaseNumberProgress{
  filled:number;
  total:number;
  missingDocIds:string[];
  complete:boolean;
}

export function summarizeCaseNumbers(record:StoredCase):CaseNumberProgress{
  const docs=record.caseInput.docs;
  const missingDocIds:string[]=[];
  let filled=0;
  for(const [docId,key] of TIMELINE){
    const entry=docs[key];
    const num='registryLogNo' in entry?entry.registryLogNo:('runningNo' in entry?entry.runningNo:undefined);
    if(num&&entry.date)filled++;
    else missingDocIds.push(docId);
  }
  return {filled,total:TIMELINE.length,missingDocIds,complete:missingDocIds.length===0};
}

export interface CaseMonthGroup{
  key:string;
  fiscalYearBE:number;
  monthKey:string;
  label:string;
  cases:StoredCase[];
}

export function groupCasesByFiscalMonth(cases:StoredCase[]):CaseMonthGroup[]{
  const buckets=new Map<string,CaseMonthGroup>();
  for(const item of cases){
    const fiscalYearBE=deriveCaseFiscalYear(item);
    const monthKey=deriveCaseMonthKey(item);
    const key=`${fiscalYearBE}::${monthKey||'NONE'}`;
    let group=buckets.get(key);
    if(!group){
      group={
        key,
        fiscalYearBE,
        monthKey,
        label:monthKey?`${formatThaiMonthYear(monthKey)} · ปีงบประมาณ ${fiscalYearBE}`:`ยังไม่ระบุเดือน · ปีงบประมาณ ${fiscalYearBE}`,
        cases:[],
      };
      buckets.set(key,group);
    }
    group.cases.push(item);
  }
  return Array.from(buckets.values()).sort((a,b)=>{
    if(a.fiscalYearBE!==b.fiscalYearBE)return b.fiscalYearBE-a.fiscalYearBE;
    if(!a.monthKey&&!b.monthKey)return 0;
    if(!a.monthKey)return 1;
    if(!b.monthKey)return -1;
    return b.monthKey.localeCompare(a.monthKey);
  });
}
