import {newDraft} from './document';
import {documentHtml,escapeHtml,type DocumentAssets} from './render-document';
import {formDefinition,calculatedRows,type InventoryFormInput,type FormField} from './inventory-forms';
export function inventoryFormHtml(d:InventoryFormInput,_interactive=false,assets?:Partial<DocumentAssets>,wordParagraphs=false){
 const def=formDefinition(d.templateId),e=escapeHtml;
 const p=(text:string,cls='inventory-field')=>'<p class="'+cls+'">'+e(text)+'</p>';
 const paragraphs=(text:string)=>text.split(/\r?\n/).filter(s=>s.trim()).map(s=>p(s,'body-text')).join('');
 const blocks:string[]=[];
 if(d.department&&d.templateId!==8)blocks.push(p('ส่วนราชการ / หน่วยงาน  '+d.department));
 for(const field of def.fields as FormField[]){
  if(d.templateId===8&&['number','recipient','fiscalYear'].includes(field.key))continue;
  const value=d.fields[field.key]||'';
  if(!value.trim())continue;
  if(field.multiline)blocks.push('<div class="inventory-heading">'+p(field.label,'title')+'</div>',paragraphs(value));
  else blocks.push(p(field.label+'  '+value));
 }
 const rows=calculatedRows(d);
 if(def.columns.length){
  const heads=['ลำดับ',...def.columns.map(c=>c.label)];
  const weights:Record<number,number[]>={1:[2,4,3,2,1.3,1.3,1.5,3],2:[2,2.4,3.5,1.2,1.8,2,1.4,1.4,2,2,2,2],3:[2,2.8,4.5,1.2,2.1,2.3,2.5],4:[5,1.3,2,2,2.2],5:[4.7,1.4,1.4,2.6,2.3],6:[2.5,4,1.2,1.2,2,2.2,2,2,2],7:[2.5,4,3,3,2,2,2]};
  const widths=weights[d.templateId],sum=widths.reduce((a,b)=>a+b,0),available=def.landscape?250:148;
  const value=(r:Record<string,string>,c:FormField)=>{const v=r[c.key]||'';return v.trim()&&['unitCost','total','depreciation','accumulated','netValue'].includes(c.key)&&Number.isFinite(Number(v))?Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}):v;};
  blocks.push('<table class="document-table"><thead><tr>'+heads.map((h,i)=>'<th style="width:'+(i===0?12:available*widths[i-1]/sum)+'mm'+(i===0?';white-space:nowrap':'')+'">'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+
   (rows.length?rows:[{}]).map((r,i)=>'<tr><td>'+String(i+1)+'</td>'+(def.columns as FormField[]).map(c=>'<td'+(c.numeric?' style="text-align:right"':'')+'>'+e(value(r,c))+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
  if([5,6].includes(d.templateId)&&rows.length){
   const complete=rows.every(r=>r.total?.trim()&&Number.isFinite(Number(r.total)));
   blocks.push(p(complete?'รวมจำนวนเงิน  '+rows.reduce((sum,r)=>sum+Number(r.total),0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท':'รวมจำนวนเงิน  ................................ บาท (ยังระบุมูลค่าไม่ครบ)','inventory-total'));
  }
 }
 if(d.footer.trim())blocks.push(paragraphs(d.footer));
 // Each signer stays together; individual blocks also remain editable in Word.
 for(const s of d.signers)blocks.push('<div class="signature inventory-signature">'+p('ลงชื่อ ........................................................ '+s.role)+p('('+(s.name||'........................................................')+')')+p(s.position||'ตำแหน่ง ........................................................')+'</div>');
 const draft={...newDraft(d.templateId===8?'internal':'other'),subject:def.name+(d.templateId===8?' ประจำปีงบประมาณ พ.ศ. '+(d.fields.fiscalYear||''):''),organization:d.organization,department:d.department,number:d.fields.number||'',recipient:d.fields.recipient||'',date:d.asOf,body:'',signer:'',position:'',closing:''};
 const fullAssets:DocumentAssets={regular:assets?.regular||'/fonts/THSarabunNew.ttf',bold:assets?.bold||'/fonts/THSarabunNew-Bold.ttf',garuda:assets?.garuda||'',routingStamp:'',copyMark:'',thaiTerms:assets?.thaiTerms};
 let html=documentHtml(draft,fullAssets,{}, {wordParagraphs,bodyBlocks:blocks});
 const css='.inventory-field{margin:0 0 3pt!important;text-indent:0!important}.inventory-heading p{margin:6pt 0 0!important}.inventory-total{text-align:right;margin-top:6pt}.inventory-signature{width:95mm!important;margin:9mm 0 0 auto!important;break-inside:avoid;text-align:center}.inventory-signature p{margin:0!important;line-height:1.1}.document-table{font-size:14pt;line-height:1.1}.document-table th,.document-table td{padding:3pt 4pt;overflow-wrap:anywhere}.document-table th{font-weight:bold}.document-table td:first-child{text-align:center}.body-text{white-space:normal}'+
 (def.landscape?'@page{size:A4 landscape!important;margin:0}.page{--center-inset:5mm;width:297mm!important;height:210mm!important;padding:16mm 15mm 18mm 20mm!important}.page .content,.page:first-child .content{height:169mm!important}.page-number{top:5mm!important}':'');
 html=html.replace('</style>',css+'</style>');return html;
}
