import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {documentTemplates,d01Slots,d01Optional} from './procurement-documents';
import {inspect,replaceTemplateText} from './procurement-template';
import type {TemplateValues} from './procurement-lab/template-model';
export async function d01Initial(reference:Buffer){
 if(createHash('sha256').update(reference).digest('hex')!==documentTemplates.D01.sha256)throw Error('แม่แบบ D01 ไม่ตรงต้นฉบับที่ตรวจไว้');
 const inspected=await inspect(reference),values:TemplateValues={};
 for(const slot of d01Slots){const valuesAtTargets=slot.targets.map(target=>{let text=inspected.value(target.p,target.nodes);if(target.parentheses)text=text.replace(/^\(/,'').replace(/\)$/,'');if(target.prefix&&text.startsWith(target.prefix))text=text.slice(target.prefix.length);return text;});if(valuesAtTargets.some(value=>value!==valuesAtTargets[0]))throw Error('ช่องคู่สำรอง D01 ไม่ตรงกัน: '+slot.key);values[slot.key]=valuesAtTargets[0];}
 return values;
}
export async function fillD01Template(input:unknown,reference:Buffer){
 const shape=Object.fromEntries(d01Slots.map(slot=>[slot.key,z.string().min(d01Optional.includes(slot.key)?0:1).max(slot.max).regex(/^[^\x00-\x1f\x7f]*$/)])),values=z.object(shape).strict().parse(input) as TemplateValues;
 const month=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].indexOf(values.month);
 const day=Number(values.day),year=Number(values.year),date=new Date(Date.UTC(year-543,month,day));
 if(!/^\d{1,2}$/.test(values.day)||!/^\d{4}$/.test(values.year)||year<2443||year>2742||month<0||date.getUTCDate()!==day||date.getUTCMonth()!==month)throw Error('วันที่ D01 ไม่ถูกต้อง');
 const initial=await d01Initial(reference),changed=d01Slots.filter(slot=>values[slot.key]!==initial[slot.key]).map(slot=>slot.key),changes=[];
 for(const slot of d01Slots)if(changed.includes(slot.key))for(const target of slot.targets)changes.push({p:target.p,nodes:target.nodes,text:target.parentheses?'('+values[slot.key]+')':values[slot.key]?(target.prefix||'')+values[slot.key]:''});
 return {...await replaceTemplateText(reference,changes),changed,sourceHash:documentTemplates.D01.sha256};
}
