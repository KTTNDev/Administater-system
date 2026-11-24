import 'server-only';
import {inspect,templateInitial} from './procurement-template';
import {d01Initial} from './procurement-d01-template';
import {procurementTemplateBytes} from './procurement-db';
import {arabicDigits} from './procurement-register';
type Alias={from:string;to:string};
const withoutParentheses=(s:string)=>s.trim().replace(/^\(/,'').replace(/\)$/,'').trim();
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
/** Derive variable values from retained private sources; the source wording itself remains authoritative. */
export async function sourceBindings(){
 const d7=(await templateInitial(procurementTemplateBytes('D07'))).values,d1=await d01Initial(procurementTemplateBytes('D01'));
 const po=await inspect(procurementTemplateBytes('D09')),acceptance=await inspect(procurementTemplateBytes('D11')),notice=await inspect(procurementTemplateBytes('N01'));
 const own=(i:Awaited<ReturnType<typeof inspect>>,p:number,nodes?:number[])=>i.value(p,nodes||i.ownNodes(p));
 const address1=own(po,6,[1,2,3,4]),address2=own(po,7,[0,1,2,3,4]),contact=withoutParentheses(own(po,69)),letterContact=own(notice,7).replace(/^เรียน\s*/,'').trim();
 const aliases:Alias[]=[
  ...['department','proposerPosition','directorPosition','secretaryPosition','secretaryActing','authorityPosition','authorityActing','proposer','director','secretary','authority'].map(key=>({from:d7[key],to:'{{'+key+'}}'})),
  {from:d7.vendor,to:'{{vendor}}'},{from:d7.vendor.replace(/^ร้าน\s*/, 'ร้าน '),to:'{{vendor}}'},
  {from:address1+' '+address2,to:'{{vendorAddress}}'},
  {from:own(po,8,[2]),to:'{{vendorPhone}}'},{from:own(po,9,[2]),to:'{{vendorTaxId}}'},
  {from:contact,to:contact.startsWith('คุณ')?'คุณ{{vendorPersonName}}':'{{vendorContact}}'},
  {from:letterContact,to:'{{vendorContact}}'},{from:own(po,70),to:'{{vendorPosition}}'},
  {from:own(po,8,[3,4]).replace(/^ที่อยู่\s*/,''),to:'{{organizationAddress}}'},
  {from:own(po,9,[3,4,5]).replace(/^โทรศัพท์\s*/,''),to:'{{organizationPhone}}'},
  {from:withoutParentheses(own(acceptance,18)),to:'{{inspector}}'},
 ];
 const dateAliases:{day:string;month:string;year:string;key:string}[]=[];
 const addDate=(text:string,key:string)=>{const match=arabicDigits(text).match(/(\d{1,2})\s*(?:เดือน)?\s*([ก-๙]+)\s*(?:พ\.ศ\.)?\s*(25\d{2})/);if(match&&months.includes(match[2]))dateAliases.push({day:match[1],month:match[2],year:match[3],key});};
 addDate(own(po,6,[6,7,8,9]),'order');
 const appointment=await inspect(procurementTemplateBytes('D06'));addDate(own(appointment,16),'appointment');
 addDate(own(acceptance,1),'inspection');
 const inspectionReport=await inspect(procurementTemplateBytes('D12'));
 aliases.push({from:own(inspectionReport,16),to:'{{inspectorPosition}}'});
 const dueText=own(inspectionReport,6),dueIndex=dueText.indexOf('ครบกำหนด');if(dueIndex>=0)addDate(dueText.slice(dueIndex),'contractDue');
 const numbers:Alias[]=[{from:own(po,5,[7,8,9,10]),to:'{{orderNumber}}'},
  {from:own(appointment,5).replace(/^ที่\s*/,''),to:'{{appointmentNumber}}'},
  {from:d1.number,to:'{{D01Number}}'}];
 // The assignment number is reused by the report, not invented from the report's own number.
 const assignment=await inspect(procurementTemplateBytes('D02')),numberNodes=assignment.ownNodes(2),dateIndex=numberNodes.find(n=>assignment.value(2,[n]).trim()==='วันที่')!;
 numbers.push({from:assignment.value(2,numberNodes.filter(n=>n>=2&&n<dateIndex)),to:'{{D02Number}}'});
 const assignmentDate=numberNodes.filter(n=>n>dateIndex).map(n=>assignment.value(2,[n])).join('');addDate(assignmentDate,'D02');
 const replacements=[...aliases,...numbers].filter(a=>a.from?.trim()).sort((a,b)=>b.from.length-a.from.length).map(a=>({...a,pattern:new RegExp(arabicDigits(a.from).trim().split(/\s+/).map(escape).join('\\s*').replace(/[–—]/g,'[-–—]'),'g')}));
 return (source:string,code:string,p:number)=>{
  let text=arabicDigits(source);
  for(const alias of replacements)text=text.replace(alias.pattern,alias.to);
  for(const date of dateAliases){const re=new RegExp('('+escape(date.day)+')(\\s*(?:เดือน)?\\s*)('+escape(date.month)+')(\\s*(?:พ\\.ศ\\.)?\\s*)('+date.year+')','g');text=text.replace(re,(_,d,a,m,b,y,offset)=>{const before=text.slice(0,offset),key=date.key==='inspection'&&before.lastIndexOf('ส่งมอบ')>before.lastIndexOf('ตรวจรับ')?'delivery':date.key;return '{{'+key+'Day}}'+a+'{{'+key+'Month}}'+b+'{{'+key+'Year}}';});}
  text=text.replace(/ร้าน\s*ดินสอสี/g,'{{vendor}}').replace(/เทศบาลตำบลฉลอง/g,'{{organization}}').replace(/กองสวัสดิการสังคม/g,'{{unit}}');
  text=text.replace(/วัสดุสำนักงาน\s*จำนวน\s*[24]\s*รายการ/g,'{{item}}').replace(/วัสดุสำนักงาน/g,'{{category}}');
  text=text.replace(/(?:1,520|1,366)(\.00|\.\s*-)/g,(_,suffix)=>suffix==='.00'?'{{agreed}}':'{{agreedText}}').replace(/หนึ่งพัน[^()]*?บาทถ้วน/g,'{{amountWords}}');
  text=text.replace(/30,000\.\s*-/g,'{{allocatedBudgetText}}').replace(/สามหมื่นบาทถ้วน/g,'{{allocatedBudgetWords}}').replace(/28,438\.\s*-/g,'{{budgetSpentText}}').replace(/1,562\.\s*-/g,'{{remainingBudgetText}}');
  text=text.replace(/2570/g,'{{budgetYear}}').replace(/ภายใน\s*3\s*วัน/g,'ภายใน {{deliveryDays}} วัน');
  text=text.replace(/จัดซื้อ(?!จัดจ้าง)/g,'{{action}}').replace(/ใบสั่งซื้อ/g,'ใบสั่ง{{buyVerb}}').replace(/ขอซื้อ/g,'ขอ{{buyVerb}}');
  if(code==='D04'&&p===12||code==='D05'&&p===8)text='{{itemLines}}';
  if(code==='D04'&&p===13||code==='D05'&&p===9)text='';
  return text;
 };
}
