import {referenceText,emptyReference} from './budget-references';
import {newDraft,type Draft} from './document';
import {baht,cents,budgetTotals,type Budget} from './budget';
export function budgetDraft(b:Budget):Draft{
 const d=newDraft('internal'),total=budgetTotals(b);const blocks:Draft['contentBlocks']=[];
 const text=(value:string)=>value.split('\n').filter(Boolean).forEach(text=>blocks.push({kind:'paragraph',label:'',text}));const heading=(text:string)=>blocks.push({kind:'heading',label:'',text});const row=(label:string,text:string)=>blocks.push({kind:'line',label,text});
 heading('1. เรื่องเดิม');text(b.background);heading('2. ข้อเท็จจริง');text(b.reason);
 const money=(label:string,value:number)=>blocks.push({kind:'budget-money' as const,label,text:baht(value)});
 const detail=(value:string,kind:'budget-detail'|'budget-spec'='budget-detail')=>value.split('\n').filter(Boolean).forEach(text=>blocks.push({kind,label:'',text}));
 for(const [direction,items] of [['decrease',b.decreases],['increase',b.increases]] as const)items.forEach((r,i)=>{
  heading(`${direction==='decrease'?'โอนลด':r.newItem?'โอนตั้งจ่ายเป็นรายการใหม่':'โอนเพิ่ม'}${items.length>1?` — รายการที่ ${i+1}`:''}`);
  const labels=direction==='decrease'?[['หน่วยงาน',r.department],['แผนงาน',r.plan],['งาน',r.work],['รายจ่าย',r.category],['ประเภท',r.type],...(r.item!==r.type?[['รายการ',r.item]]:[])]:[['หน่วยงาน',r.department],['แผนงาน',r.plan],['งาน',r.work],['งบ',r.fund.replace(/^งบ/,'')],['หมวด',r.category],['ประเภท',r.type],['รายการ',r.item]];
  for(const [label,value] of labels)if(value)row(label,value);
  if(direction==='increase'&&r.newItem)money('งบประมาณตั้งจ่ายไว้',cents(r.amount));
  else{money('ตั้งจ่ายไว้',cents(r.allocated));money('คงเหลืองบประมาณก่อนโอน',cents(r.remaining));money(direction==='decrease'?'โอนลดครั้งนี้':'โอนเพิ่มครั้งนี้',cents(r.amount));money('งบประมาณคงเหลือหลังโอน',cents(r.remaining)+(direction==='decrease'?-1:1)*cents(r.amount));}
  if(r.purpose)detail(r.purpose);if(r.specification){detail('โดยมีคุณลักษณะดังนี้');detail(r.specification,'budget-spec');}
  if(direction==='increase')for(const citation of referenceText({...emptyReference(),...r}))detail('- '+citation,'budget-spec');
 });
 row('รวมโอนลด',`${baht(total.decrease)} บาท`);row('รวมโอนเพิ่ม',`${baht(total.increase)} บาท`);
 heading('3. ข้อระเบียบ / กฎหมาย / หนังสือสั่งการที่เกี่ยวข้อง');text('ระเบียบกระทรวงมหาดไทยว่าด้วยวิธีการงบประมาณขององค์กรปกครองส่วนท้องถิ่น พ.ศ. 2563 หมวด 4 '+(b.authority==='council'?'ข้อ 27 การโอนงบลงทุนที่ทำให้ลักษณะ ปริมาณ คุณภาพเปลี่ยน หรือโอนไปตั้งจ่ายเป็นรายการใหม่ เป็นอำนาจอนุมัติของสภาท้องถิ่น':b.authority==='executive'?'ข้อ 26 การโอนเงินงบประมาณรายจ่ายต่าง ๆ เป็นอำนาจอนุมัติของผู้บริหารท้องถิ่น':'[รอตรวจสอบผู้มีอำนาจอนุมัติและข้อระเบียบที่ใช้]'));text(b.legalNotes);heading('4. ข้อพิจารณา / ข้อเสนอแนะ');text(b.proposal||(b.authority==='council'?'เห็นควรนำเข้าที่ประชุมสภาเทศบาลเพื่อพิจารณาอนุมัติต่อไป':'เห็นควรเสนอผู้มีอำนาจพิจารณาอนุมัติต่อไป'));text('จึงเรียนมาเพื่อโปรดพิจารณา');
 return {...d,layout:'budget-reference',memoGuides:true,subject:`${b.title} ประจำปีงบประมาณ พ.ศ. ${b.year}${b.increases.some(r=>r.newItem)?' (โอนตั้งจ่ายเป็นรายการใหม่)':''}`,date:b.date,organization:b.organization,department:b.department,phone:b.phone,number:b.number,recipient:b.recipient,signer:b.signer,position:b.position,numeralStyle:b.numeralStyle,body:blocks.map(x=>[x.label,x.text].filter(Boolean).join(' ')).join('\n'),contentBlocks:blocks,opinions:b.opinions.map(p=>({...p,lines:2}))};
}
