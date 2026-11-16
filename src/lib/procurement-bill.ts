import {z} from 'zod';
const decimal=z.string().regex(/^\d{1,9}(?:\.\d{1,2})?$/,'ใช้จำนวนบวก ทศนิยมไม่เกินสองตำแหน่ง');
export const billSchema=z.object({
 items:z.array(z.object({id:z.string().min(1).max(80),description:z.string().trim().min(1).max(500).regex(/^[^\x00-\x1f\x7f]*$/),quantity:decimal.refine(v=>Number(v)>0),unit:z.string().trim().min(1).max(40).regex(/^[^\x00-\x1f\x7f]*$/),unitPrice:decimal,offeredUnitPrice:z.union([decimal,z.literal('')]).optional()})).max(100).default([]),
 summary:z.string().max(110).regex(/^[^\x00-\x1f\x7f]*$/).default(''),vatMode:z.enum(['included','excluded','none']).default('included'),vatRate:decimal.refine(v=>Number(v)<=100).default('7'),
 referencePriceFromOffer:z.boolean().default(false),
}).strict().refine(bill=>new Set(bill.items.map(item=>item.id)).size===bill.items.length,'รหัสรายการสินค้าซ้ำ').default(()=>({items:[],summary:'',vatMode:'included' as const,vatRate:'7',referencePriceFromOffer:false}));
export type ProcurementBill=z.infer<typeof billSchema>;
export const minor=(value:string)=>{const [a,b='']=value.replaceAll(',','').split('.');return BigInt(a||'0')*100n+BigInt(b.padEnd(2,'0'));};
export const formatMoney=(value:bigint)=>{const s=value.toString().padStart(3,'0');return s.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+s.slice(-2);};
export function billTotals(bill:ProcurementBill){
 const lines=bill.items.map(line=>(minor(line.quantity)*minor(line.unitPrice)+50n)/100n),offeredLines=bill.items.map(line=>(minor(line.quantity)*minor(line.offeredUnitPrice||line.unitPrice)+50n)/100n),subtotal=lines.reduce((a,b)=>a+b,0n),offeredSubtotal=offeredLines.reduce((a,b)=>a+b,0n),rate=minor(bill.vatRate);
 const net=bill.vatMode==='included'?(subtotal*10000n+(10000n+rate)/2n)/(10000n+rate):subtotal;
 const vat=bill.vatMode==='none'?0n:bill.vatMode==='included'?subtotal-net:(net*rate+5000n)/10000n;
 const offeredTotal=bill.vatMode==='excluded'?offeredSubtotal+(offeredSubtotal*rate+5000n)/10000n:offeredSubtotal;
 return {lines,offeredLines,offeredTotal,subtotal,net,vat,total:net+vat};
}
export function bahtWords(value:bigint):string{
 const digits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'],places=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
 const read=(n:bigint,higher=false):string=>{if(n>=1000000n)return read(n/1000000n)+'ล้าน'+(n%1000000n?read(n%1000000n,true):'');const s=n.toString();return [...s].map((c,i)=>{const v=Number(c),p=s.length-i-1;if(!v)return '';if(p===1)return (v===1?'':v===2?'ยี่':digits[v])+places[p];if(p===0&&v===1&&(s.length>1||higher))return 'เอ็ด';return digits[v]+places[p];}).join('');};
 return (value/100n?read(value/100n):'ศูนย์')+'บาท'+(value%100n?read(value%100n)+'สตางค์':'ถ้วน');
}
export function moneyWords(value:string){return /^\d{1,18}(?:,\d{3})*(?:\.\d{1,2})?$/.test(value.trim())?bahtWords(minor(value.trim())):'';}
export const monetaryWordSources:Record<string,string>={allocatedBudgetWords:'allocatedBudget',amountWords:'agreed',agreedWords:'agreed',offeredWords:'offered',remainingBudgetWords:'remainingBudget',referencePriceWords:'referencePrice'};
function withMoneyWords(values:Record<string,string>){return {...values,allocatedBudgetWords:moneyWords(values.allocatedBudget||''),amountWords:moneyWords(values.agreed||''),agreedWords:moneyWords(values.agreed||''),offeredWords:moneyWords(values.offered||''),remainingBudgetWords:moneyWords(values.remainingBudget||''),referencePriceWords:moneyWords(values.referencePrice||'')};}
export function billValues(data:{bill?:ProcurementBill;common:Record<string,string>}):Record<string,string>{
 const base=withMoneyWords(data.common);
 if(!data.bill?.items.length)return base;
 const parsed=billSchema.safeParse(data.bill);if(!parsed.success)return base;
 const totals=billTotals(parsed.data),names=data.bill.items.map(line=>line.description).join(', '),suffix=data.bill.items.length>1?' จำนวน '+data.bill.items.length+' รายการ':'',item=data.bill.summary||((names.length>90?data.common.category||'พัสดุ / งานตามรายการแนบ':names).slice(0,110-suffix.length)+suffix);
 return withMoneyWords({...base,item,agreed:formatMoney(totals.total),offered:formatMoney(totals.offeredTotal),...(data.bill.referencePriceFromOffer?{referencePrice:formatMoney(totals.offeredTotal)}:{}),net:formatMoney(totals.net),vat:formatMoney(totals.vat),itemCount:String(data.bill.items.length)});
}
