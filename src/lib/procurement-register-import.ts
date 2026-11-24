import {arabicDigits} from './procurement-register';
export type ReservationCandidate={raw:string;code:string;number:string;date:string};
const rules:[RegExp,string][]=[[/แจ้ง.*ผู้ชนะ|แจ้ง.*ลงนาม/,'N01'],[/ประกาศ.*ผู้ชนะ/,'D08'],[/ต่อรอง|ใบเสนอราคา|ใบส่งของ/,''],[/มอบหมาย/,'D02'],[/อนุมัติ.*(?:จัดซื้อ|จัดจ้าง)/,'D01'],[/กำหนด.*TOR|รายงาน.*คุณลักษณะ/,'D03'],[/^TOR|ร่าง.*ขอบเขต/,'D04'],[/รายงาน.*(?:Laas|e-LAAS)/i,'L01'],[/คำสั่ง.*ตรวจรับ/,'D06'],[/รายงานผล.*รายละเอียด|ขั้นตอน|วิธีการ/,'D13'],[/รายงานผล.*ตรวจรับ/,'D12'],[/รายงาน.*พิจารณา/,'D07'],[/รายงาน.*(?:จัดซื้อ|ขอซื้อ|ขอจ้าง)/,'D05'],[/ใบสั่ง/,'D09'],[/รูปภาพ|ภาพประกอบ/,'P01'],[/ใบตรวจรับ/,'D11'],[/อนุมัติ.*เบิก/,'D14']];
const months=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
/** A TXT is a proposal only. Nothing here reserves a number or chooses between conflicting sources. */
export function parseReservationText(text:string,year:number):ReservationCandidate[]{
 return text.slice(0,50000).split(/\r?\n/).filter(line=>line.includes('=')).map(raw=>{
  const [name,...rest]=raw.split('='),right=arabicDigits(rest.join('=').trim()),code=rules.find(([re])=>re.test(name))?.[1]||'';
  const match=right.match(/(?:^|\s)(\d{1,2})\s*([ก-๙.]+)\s*$/),month=match?months.indexOf(match[2].replaceAll('.','')):-1;
  const date=match&&month>=0?`${year-543}-${String(month+1).padStart(2,'0')}-${match[1].padStart(2,'0')}`:'',number=(match&&month>=0?right.slice(0,match.index):right).trim();
  return {raw:name.trim(),code,number:/^[0-9/\sก-๙A-Za-z.-]*$/.test(number)?number:'',date};
 });
}
