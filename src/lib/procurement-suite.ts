import 'server-only';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {inspect,replaceTemplateText,linkContinuationFooter,templateInitial} from './procurement-template';
import {documentTemplates,type DraftDocumentCode} from './procurement-documents';
import {procurementTemplateBytes} from './procurement-db';
import {d01Values,d07Values,type ProcurementInput} from './procurement';
import {billValues,billTotals,minor,formatMoney,bahtWords,monetaryWordSources} from './procurement-bill';
import {procurementCorrespondence} from './procurement-correspondence';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const xmlEscape=(s:string)=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
export const thaiDate=(iso:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;const [year,month,day]=iso.split('-').map(Number);return `${day} ${months[month-1]} ${year+543}`;};
export function suiteValues(data:ProcurementInput,code:DraftDocumentCode):Record<string,string>{
 const common=billValues(data),own=data.documents[code],sharedDate=`${common.day} ${common.month} ${common.year}`,dateInput=own?.date||(code==='D06'?common.appointmentDate:code==='D09'?common.orderDate:code==='D11'?common.inspectionDate:''),date=dateInput?thaiDate(dateInput):sharedDate,number=own?.number||(code==='D01'?data.d01.number:code==='D07'?common.number:code==='D06'?common.appointmentNumber:code==='D09'?common.orderNumber:'');
 const action=data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง',subjects:Record<string,string>={D02:'ขออนุมัติมอบหมายกำหนดคุณลักษณะ'+action+common.item,D03:'รายงานผลจัดทำคุณลักษณะ'+common.item,D05:'รายงานขอ'+(data.kind==='purchase'?'ซื้อ':'จ้าง')+common.item,D06:'แต่งตั้งผู้ตรวจรับพัสดุ',D08:'ประกาศผู้ชนะการเสนอราคา'+action+common.item,D14:'ขออนุมัติเบิกจ่ายเงินค่า'+action+common.item};
 let amountWords=common.amountWords||'',net=common.net||'',vat=common.vat||'';
 if(/^\d[\d,]*(?:\.\d{1,2})?$/.test(common.agreed)){const total=minor(common.agreed),rate=minor(data.bill.vatRate),base=data.bill.vatMode==='none'?total:(total*10000n+(10000n+rate)/2n)/(10000n+rate);amountWords=bahtWords(total);net=formatMoney(base);vat=formatMoney(total-base);}
 const values:Record<string,string>={...common,action:data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง',buyVerb:data.kind==='purchase'?'ซื้อ':'จ้าง',number,docDate:date,subject:own?.subject||subjects[code]||documentTemplates[code].name.replaceAll('ขอซื้อ / ขอจ้าง','ขอ'+(data.kind==='purchase'?'ซื้อ':'จ้าง')),amountWords,net,vat,contractDue:thaiDate(data.contractDue),orderNumber:data.documents.D09?.number||common.orderNumber,orderDate:thaiDate(data.documents.D09?.date||common.orderDate),deliveryDate:thaiDate(common.deliveryDate),inspectionDate:thaiDate(common.inspectionDate),appointmentNumber:data.documents.D06?.number||common.appointmentNumber,appointmentDate:thaiDate(data.documents.D06?.date||common.appointmentDate),taxDescription:data.bill.vatMode==='none'?'ไม่มีภาษีมูลค่าเพิ่ม':'รวมภาษีมูลค่าเพิ่ม',itemLines:data.bill.items.map((item,i)=>`${i+1}. ${item.description} จำนวน ${item.quantity} ${item.unit}`).join(' / ')};
 for(const key of Object.keys(documentTemplates)){const config=data.documents[key as DraftDocumentCode],fallback=key==='D06'?common.appointmentDate:key==='D09'?common.orderDate:key==='D11'?common.inspectionDate:'';values[key+'Number']=config?.number||(key==='D01'?data.d01.number:key==='D07'?common.number:key==='D06'?common.appointmentNumber:key==='D09'?common.orderNumber:'');values[key+'Date']=config?.date?thaiDate(config.date):fallback?thaiDate(fallback):sharedDate;}
 values.D11Date=values.inspectionDate;
 values.inspectionResult=({pending:'ยังไม่บันทึกผลตรวจรับ',complete:'ถูกต้องครบถ้วนตามสัญญา',partial:'ไม่ครบถ้วนตามสัญญา',rejected:'ไม่เป็นไปตามสัญญา'} as const)[data.inspection.result];values.inspectionNotes=data.inspection.notes.replace(/\s+/g,' ')||'—';
 values.organizationPhone=common.organizationPhone||common.department.match(/โทร(?:ศัพท์)?\.?\s*(.+)$/)?.[1]||'';
 values.proposerPosition||='';values.directorRecipient||=common.secretaryPosition;values.secretaryRecipient||=common.authorityPosition;
 return values;
}
const manual:Partial<Record<DraftDocumentCode,Record<number,string>>>={
 D03:{7:'ตามบันทึกข้อความ{{unit}} ที่ {{D02Number}} ลงวันที่ {{D02Date}} เรื่อง มอบหมายหน้าที่การกำหนดคุณลักษณะ{{action}}{{item}} นั้น'},
 D04:{14:'{{itemLines}}',15:'',17:'4.2.1 ผู้ขาย / ผู้รับจ้างจะต้องส่งมอบภายใน {{deliveryDays}} วัน ตามเงื่อนไขในสัญญา / ใบสั่ง ณ {{deliveryPlace}}',20:'ภายใน {{deliveryDays}} วัน ตามเงื่อนไขในสัญญา / ใบสั่ง',22:'กำหนดส่งมอบภายใน {{deliveryDays}} วัน ตามเงื่อนไขในสัญญา / ใบสั่ง',24:'{{penalty}}'},
 D05:{9:'{{itemLines}}',10:'',11:'3. ราคากลาง / ราคาอ้างอิงที่ตรวจแล้ว {{referencePrice}} บาท',19:'2. อนุมัติแต่งตั้งให้ {{inspector}} ตำแหน่ง {{inspectorPosition}} เป็นผู้ตรวจรับพัสดุ'},
 D06:{4:'',5:'ที่ {{number}}',6:'เรื่อง {{subject}}',11:'ด้วย {{unit}} {{organization}} มีความประสงค์จะ{{action}}{{item}} และเพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 จึงแต่งตั้ง {{inspector}} ตำแหน่ง {{inspectorPosition}} เป็นผู้ตรวจรับพัสดุสำหรับงานดังกล่าว',13:'ผู้ตรวจรับพัสดุ {{inspector}} ตำแหน่ง {{inspectorPosition}} มีอำนาจและหน้าที่ตรวจรับพัสดุให้เป็นไปตามเงื่อนไขของสัญญาหรือข้อตกลง',16:'สั่ง ณ วันที่ {{docDate}}'},
 D08:{2:'เรื่อง {{subject}} ของ{{unit}} {{organization}}',7:'บัดนี้ {{action}}{{item}} ผู้ได้รับการคัดเลือก ได้แก่ {{vendor}} เป็นเงินทั้งสิ้น {{agreed}} บาท ({{amountWords}}) {{taxDescription}} และค่าใช้จ่ายตามข้อเสนอที่ตรวจแล้ว',10:'ประกาศ ณ วันที่ {{docDate}}'},
 D09:{5:'ผู้รับ{{buyVerb}} {{vendor}} ใบสั่ง{{buyVerb}} เลขที่ {{orderNumber}}',6:'ที่อยู่ {{vendorAddress}} วันที่ {{orderDate}}',7:'ส่วนราชการ {{organization}}',8:'โทรศัพท์ร้านค้า {{vendorPhone}} ที่อยู่หน่วยงาน {{organizationAddress}}',9:'เลขผู้เสียภาษี {{vendorTaxId}}',16:'จำนวน',17:'หน่วย',20:'1',21:'{{item}}',22:'1',23:'งาน',24:'{{agreed}}',25:'{{agreed}}',26:'({{amountWords}})',29:'{{net}}',33:'{{vat}}',36:'{{agreed}}',39:'1. กำหนดส่งมอบภายใน {{deliveryDays}} วัน ตามจุดเริ่มนับที่ระบุในสัญญา / ใบสั่ง',40:'2. กำหนดส่งมอบภายในวันที่ {{contractDue}}',41:'3. สถานที่ส่งมอบ ณ {{deliveryPlace}}',43:'5. {{penalty}}',44:'',69:'วันที่ {{orderDate}}',12:'     ตามที่ {{vendor}} ได้เสนอราคาไว้ต่อ {{organization}} และได้ตกลง{{buyVerb}}ตามรายการดังต่อไปนี้',73:'({{vendorContact}})',74:'{{vendorPosition}}',75:'วันที่ {{orderDate}}'},
 D11:{1:'วันที่ {{inspectionDate}}',3:'ตามใบสั่ง{{buyVerb}} เลขที่ {{orderNumber}} ลงวันที่ {{orderDate}} {{organization}} ได้ตกลง{{action}}{{item}} จาก {{vendor}} จำนวน {{agreed}} บาท ({{amountWords}})',4:'ผู้ตรวจรับพัสดุได้บันทึกผลตรวจรับ: {{inspectionResult}} รายละเอียด: {{inspectionNotes}}',18:'({{inspector}})'},
 D12:{7:'ตามคำสั่ง{{organization}} ที่ {{appointmentNumber}} ลงวันที่ {{appointmentDate}} เรื่อง แต่งตั้งผู้ตรวจรับพัสดุสำหรับการ{{action}}{{item}} และตามใบสั่ง{{buyVerb}} เลขที่ {{orderNumber}} ลงวันที่ {{orderDate}} โดยคู่สัญญาคือ {{vendor}} ครบกำหนดส่งมอบวันที่ {{contractDue}} นั้น',9:'ผู้ขาย / ผู้รับจ้างได้ส่งมอบพัสดุวันที่ {{deliveryDate}} ผู้ตรวจรับได้ตรวจรับวันที่ {{inspectionDate}} ผลการตรวจรับปรากฏตามใบตรวจรับที่แนบ',13:'จึงเรียนมาเพื่อโปรดทราบผลการตรวจรับตามหลักฐาน และพิจารณาเบิกจ่ายเงินให้แก่ {{vendor}} จำนวน {{agreed}} บาท ({{amountWords}})',16:'({{inspector}})',17:'{{inspectorPosition}}'},
 D13:{7:'ตามที่ {{unit}} ได้ดำเนินการ{{action}}{{item}} จาก {{vendor}} ที่อยู่ {{vendorAddress}} เลขผู้เสียภาษี {{vendorTaxId}} โทรศัพท์ {{vendorPhone}} ตามใบสั่ง{{buyVerb}} เลขที่ {{orderNumber}} ลงวันที่ {{orderDate}} จำนวน {{agreed}} บาท ({{amountWords}}) ส่งมอบวันที่ {{deliveryDate}} และตรวจรับวันที่ {{inspectionDate}} ตามหลักฐานแนบ'},
 D14:{13:'เห็นควรเบิกจ่ายค่า{{action}}{{item}} ให้แก่ {{vendor}} เป็นเงิน {{agreed}} บาท ({{amountWords}}) ตามหลักฐานและผลการตรวจรับที่แนบ เพื่อพิจารณาตามระเบียบต่อไป'},
};
async function compileSuiteParagraphs(code:DraftDocumentCode){
 const reference=procurementTemplateBytes(code),i=await inspect(reference),doc=new DOMParser().parseFromString(i.xml,'application/xml'),paragraphs=Array.from(doc.getElementsByTagNameNS(W,'p'));
 const original=(await templateInitial(procurementTemplateBytes('D07'))).values;
 const keys=['department','vendor','proposerPosition','directorPosition','secretaryPosition','secretaryActing','authorityPosition','authorityActing','proposer','director','secretary','authority'];
 const replacements=keys.map(key=>[original[key],`{{${key}}}`]).filter(([value])=>value).sort((a,b)=>b[0].length-a[0].length);
 return paragraphs.flatMap((p,index)=>{
  const nodes=i.ownNodes(index);if(!nodes.length)return [];
  const text=i.value(index,nodes);if(!text.trim())return [];
  let template=text;
  if(manual[code]?.[index]!==undefined)template=manual[code]![index];
  else{
   template=template.replace(/วัสดุสำนักงาน\s*จำนวน\s*[24]\s*รายการ/g,'{{item}}').replace(/จัดซื้อ(?=\{\{item\}\})/g,'{{action}}');
   template=template.replace(/ร้านดินสอสี/g,'{{vendor}}');
   for(const [value,token] of replacements){const escaped=value.trim().split(/\s+/).map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');if(escaped)template=template.replace(new RegExp(escaped,'g'),token);}
   template=template.replace(/เจ้าพนักงานธุรการปฏิบัติงาน/g,'{{proposerPosition}}');
   template=template.replace(/เทศบาลตำบลฉลอง/g,'{{organization}}').replace(/กองสวัสดิการสังคม/g,'{{unit}}');
   template=template.replace(/(?:๒๕[67][08]|2570|2568)(?=\s*(?:\{\{unit\}\}|ได้ตั้งงบ|กอง))/g,'{{budgetYear}}');
   template=template.replace(/คงเหลือ\s*(?:1,562|30,000)\.-/g,'คงเหลือ {{remainingBudget}}').replace(/30,[0๐]{3}\.-/g,'{{allocatedBudget}}').replace(/สามหมื่นบาทถ้วน/g,'{{allocatedBudgetWords}}');
   template=template.replace(/หนึ่งพัน[^()]*?บาทถ้วน/g,'{{amountWords}}').replace(/1,(?:520|366)(?:\.00|\.\s*-)/g,'{{agreed}}');
   template=template.replace(/ภายใน\s*3\s*วัน/g,'ภายใน {{deliveryDays}} วัน');
   if(code!=='D01'&&code!=='D07'){
    if(index===3&&['D02','D03','D05','D12','D13','D14'].includes(code))template='ที่ {{number}} วันที่ {{docDate}}';
    if(index===4&&['D02','D03','D05','D12','D13','D14'].includes(code))template='เรื่อง {{subject}}';
   }
   template=template.replace(/รวมภาษีมูลค่าเพิ่ม/g,'{{taxDescription}}');
   template=template.replace(/วัสดุสำนักงาน/g,'{{category}}').replace(/จัดซื้อ(?!จัดจ้าง)/g,'{{action}}').replace(/ใบสั่งซื้อ/g,'ใบสั่ง{{buyVerb}}').replace(/ขอซื้อ/g,'ขอ{{buyVerb}}');
  }
  return [{p:index,nodes,text,template,tokens:[...template.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1])}];
 });
}
const paragraphCache=new Map<string,ReturnType<typeof compileSuiteParagraphs>>();
export function suiteParagraphs(code:DraftDocumentCode){procurementTemplateBytes(code);const key=code+documentTemplates[code].outputVersion;let result=paragraphCache.get(key);if(!result){result=compileSuiteParagraphs(code);paragraphCache.set(key,result);result.catch(()=>paragraphCache.delete(key));}return result;}
const optionalSuiteFields=new Set(['secretaryActing','authorityActing']);
export function resolveSuiteText(template:string,values:Record<string,string>,partial=false){return template.replace(/\{\{(\w+)\}\}/g,(token,key)=>values[key]?.trim()|| (optionalSuiteFields.has(key)?'':partial?'['+key+']':token));}
export async function suiteMissing(data:ProcurementInput,code:DraftDocumentCode){
 const values=suiteValues(data,code),paragraphs=await suiteParagraphs(code),missing=new Set<string>();
 const check=(text:string)=>{for(const match of text.matchAll(/\{\{(\w+)\}\}/g)){const key=match[1];if(!values[key]?.trim()){if(!optionalSuiteFields.has(key))missing.add(monetaryWordSources[key]||key);}else if(['agreed','offered','referencePrice','allocatedBudget','remainingBudget','net','vat'].includes(key)&&!/^\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?$/.test(values[key]))missing.add(key);}};
 for(const p of paragraphs){if(['D01','D07'].includes(code)&&data.documents[code]?.paragraphs[String(p.p)]===undefined)continue;check(data.documents[code]?.paragraphs[String(p.p)]??p.template);}
 if(code==='D01')for(const text of Object.values(data.d01))check(text);
 return [...missing];
}
function replaceLeafText(xml:string,text:string){let first=true;return xml.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,(_,a,b)=>{const value=first?xmlEscape(text):'';first=false;return a+value+b;});}
function leafText(xml:string){return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')).join('');}
async function headerChanges(reference:Buffer,data:ProcurementInput,code:DraftDocumentCode,values:Record<string,string>){
 const source=await inspect(reference),changes:{p:number;nodes:number[];text:string}[]=[],overrides=data.documents[code]?.paragraphs||{},display=(key:string)=>values[key]||'['+key+']';
 const put=(p:number,nodes:number[],text:string)=>{if(overrides[String(p)]===undefined)changes.push({p,nodes,text});};
 if(['D02','D03','D05','D12','D13','D14'].includes(code)){
  const own=source.ownNodes(2),nonblank=own.filter(index=>source.value(2,[index]).trim()),last=nonblank.at(-1)!;
  put(2,own.filter(index=>index>=2&&index<=last),code==='D12'?'ผู้ตรวจรับพัสดุ/คณะกรรมการตรวจรับพัสดุ '+display('organization'):display('department').trim());
  const dateIndex=code==='D02'||code==='D03'?5:4,yearIndex=code==='D02'?9:code==='D03'?8:7,date=values.docDate.split(' ');
  put(3,Array.from({length:dateIndex-2},(_,i)=>i+2),display('number'));put(3,[dateIndex+1],date[0]||'…');put(3,Array.from({length:yearIndex-dateIndex-2},(_,i)=>dateIndex+2+i),date[1]||'…');put(3,[yearIndex],date[2]||'…');
  put(4,source.ownNodes(4).filter(index=>index>=1),display('subject'));put(5,[2,3],display('recipient'));
 }
 if(code==='D09'){
  const address=values.vendorAddress||'[vendorAddress]';let cut=address.length>38?address.lastIndexOf(' ',38):-1;if(cut<10&&address.length>38)cut=38;const first=cut>0?address.slice(0,cut):address,second=cut>0?address.slice(cut).trim():'';const date=values.orderDate.split(' ');
  put(5,[0,1],data.kind==='purchase'?'ผู้ขาย':'ผู้รับจ้าง');put(5,[3],display('vendor'));put(5,[5],values.buyVerb+' ');put(5,[7,8,9,10],display('orderNumber'));
  put(6,[1,2,3,4,5],first);put(6,[8],date[0]||'…');put(6,[10],(date[1]||'…')+' '+(date[2]||'…'));
  put(7,[0,1,2,3,4],second);put(7,[5],'ส่วนราชการ '+display('organization'));
  put(8,[2,3],display('vendorPhone'));put(8,[5,6],'ที่อยู่ '+display('organizationAddress'));
  put(9,[0],'เลขประจำตัวผู้เสียภาษี');put(9,[2],display('vendorTaxId'));put(9,[3,4,5],'โทรศัพท์ '+display('organizationPhone'));
 }
 if(code==='D05')put(11,source.ownNodes(11).filter(index=>index>=1),'3. ราคากลาง / ราคาอ้างอิงที่ตรวจแล้ว '+display('referencePrice')+' บาท');
 if(code==='D08'){
  put(2,source.ownNodes(2).filter(index=>index<=9),'เรื่อง '+display('subject'));
  put(2,source.ownNodes(2).filter(index=>index>=10),'ของ'+display('unit')+' '+display('organization'));
  put(10,source.ownNodes(10).filter(index=>index>=6),'ประกาศ ณ วันที่ '+display('docDate'));
 }
 return changes;
}
export async function finishSuiteDocument(bytes:Buffer,data:ProcurementInput,code:DraftDocumentCode){
 const reference=procurementTemplateBytes(code),paragraphs=await suiteParagraphs(code),values=suiteValues(data,code);
 if(code!=='D01'&&code!=='D07'){const headers=await headerChanges(reference,data,code,values),mapped=new Set(headers.map(target=>target.p));bytes=(await replaceTemplateText(reference,[...paragraphs.filter(p=>!mapped.has(p.p)).map(p=>({p:p.p,nodes:p.nodes,text:resolveSuiteText(data.documents[code]?.paragraphs[String(p.p)]??p.template,values,true)})),...headers])).bytes;}
 else if(Object.keys(data.documents[code]?.paragraphs||{}).length){const base=await inspect(bytes);bytes=(await replaceTemplateText(bytes,Object.entries(data.documents[code]!.paragraphs).map(([p,text])=>({p:Number(p),nodes:base.ownNodes(Number(p)),text:resolveSuiteText(text,values,true)})))).bytes;}
 const zip=await JSZip.loadAsync(bytes);let xml=await zip.file('word/document.xml')!.async('string');
 // Source manual breaks were placed for the old vendor's text length. Let
 // Word wrap the variable vendor paragraphs naturally, avoiding stretched tails.
 if(code==='D09'||code==='D08'){let p=0;const variableParagraph=code==='D09'?12:7;xml=xml.replace(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g,paragraph=>p++===variableParagraph?paragraph.replace(/<w:br\b[^>]*\/>/g,''):paragraph);}
 if(data.bill.items.length&&['D04','D05'].includes(code)){
  const marker=resolveSuiteText('{{itemLines}}',values,true);let removeNext=false;
  xml=xml.replace(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g,p=>{if(removeNext){removeNext=false;if(!leafText(p).trim())return '';}
   if(leafText(p)!==marker)return p;removeNext=true;
   return data.bill.items.map((item,i)=>{const cells=code==='D04'?[`${i+1}. ${item.description}`,'จำนวน',item.quantity,item.unit]:[`${i+1}. `,item.description,'จำนวน',item.quantity,item.unit];let index=0;return p.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,(_,a,b)=>a+xmlEscape(cells[index++]||'')+b);}).join('');});
 }
 if(data.bill.items.length&&code==='D09'){
  const totals=billTotals(data.bill);let rowIndex=0;
  xml=xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{
   if(rowIndex++!==1)return row;
   return data.bill.items.map((item,index)=>{const cells=[String(index+1),item.description,item.quantity,item.unit,formatMoney(minor(item.unitPrice)),formatMoney(totals.lines[index])];let cell=0;return row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g,tc=>replaceLeafText(tc,cells[cell++]||''));}).join('');
  });
 }
 if(data.bill.items.length&&code==='D07'){
  const totals=billTotals(data.bill),changes=[{p:16,text:formatMoney(totals.net)},{p:17,text:data.bill.vatMode==='none'?'ภาษีมูลค่าเพิ่ม (ไม่มี VAT)':'ภาษีมูลค่าเพิ่ม '+data.bill.vatRate+'%'},{p:18,text:formatMoney(totals.vat)}];
  bytes=(await replaceTemplateText(bytes,changes)).bytes;xml=await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string');
  let rowIndex=0;xml=xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{if(rowIndex++!==1)return row;return data.bill.items.map((item,index)=>{const cells=[`${item.description} จำนวน ${item.quantity} ${item.unit}`,values.vendor,formatMoney(totals.offeredLines[index]),formatMoney(totals.lines[index])];let cell=0;return row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g,tc=>replaceLeafText(tc,cells[cell++]||''));}).join('');});
 }
 if(data.bill.items.length&&['D07','D09'].includes(code)){
  let table=0;xml=xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g,block=>{
   if(table++!==0)return block;let row=0;return block.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,part=>{
    const property=row++===0?'tblHeader':'cantSplit';if(part.includes('<w:'+property))return part;
    return part.includes('<w:trPr>')?part.replace('<w:trPr>','<w:trPr><w:'+property+'/>'):part.replace(/(<w:tr\b[^>]*>)/,'$1<w:trPr><w:'+property+'/></w:trPr>');
   });
  });
 }
 if(code==='D11'){
  const checked=[data.inspection.result==='complete',data.inspection.result==='complete',['partial','rejected'].includes(data.inspection.result),data.inspection.penalty==='yes',data.inspection.penalty==='none'];let checkbox=0;
  xml=xml.replace(/<w:sym\b[^>]*w:font="Wingdings 2"[^>]*\/>/g,tag=>tag.replace(/w:char="[^"]*"/,'w:char="'+(checked[checkbox++]?'F052':'F0A3')+'"'));
 }
 // Old forms contain runs of empty paragraphs after the final signature/date.
 // They must not become a new page containing only a continuation footer.
 for(let n=0;n<200;n++){
  // Track nested textbox paragraphs, including self-closing paragraphs. A
  // regex spanning an inner empty paragraph can otherwise remove its parent.
  let depth=0,start=0,tail:{start:number;end:number}|undefined;
  for(const tag of xml.matchAll(/<\/?w:p\b[^>]*>/g)){
   const closing=tag[0].startsWith('</'),selfClosing=tag[0].endsWith('/>');
   if(!closing&&depth===0)start=tag.index!;
   if(!closing&&!selfClosing)depth++;else if(closing)depth--;
   const end=tag.index!+tag[0].length;
   if(depth===0&&/^\s*<w:sectPr\b/.test(xml.slice(end)))tail={start,end};
  }
  if(!tail)break;const paragraph=xml.slice(tail.start,tail.end);
  if(leafText(paragraph).replace(/[\s\u00a0\u200b]/g,'')||/<w:(?:drawing|object|pict|sym|sectPr|fldChar|instrText|sdt|bookmarkStart|commentRangeStart)\b/.test(paragraph))break;
  xml=xml.slice(0,tail.start)+xml.slice(tail.end);
 }
 xml=xml.replace(/<\/w:tbl>(\s*)(?=<w:sectPr\b)/,'</w:tbl>$1<w:p><w:pPr><w:spacing w:line="1" w:lineRule="exact"/></w:pPr></w:p>');
 if(['D01','D02','D03','D05','D07','D12','D13','D14'].includes(code))xml=procurementCorrespondence(xml);
 zip.file('word/document.xml',xml,{date:zip.file('word/document.xml')!.date,createFolders:false});
 const memo=['D01','D02','D03','D05','D07','D12','D13','D14'].includes(code),date=(code==='D11'?values.inspectionDate:values.docDate).split(' '),title=['D04','D10','D11'].includes(code)?paragraphs.find(p=>p.p===0):undefined;
 const generic={...values,subject:title?resolveSuiteText(data.documents[code]?.paragraphs['0']??title.template,values,true):values.subject,number:['D04','D08','D10','D11'].includes(code)?'':values.number,day:['D04','D10'].includes(code)?'':date[0],month:['D04','D10'].includes(code)?'':date[1],year:['D04','D10'].includes(code)?'':date[2]};
 const result=await linkContinuationFooter(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),code==='D01'?d01Values(data):code==='D07'?d07Values(data):generic,memo);
 return {bytes:result,sourceHash:createHash('sha256').update(reference).digest('hex'),values};
}
