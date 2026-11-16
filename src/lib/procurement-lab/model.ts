import {z} from "zod";

const text=(max=2000)=>z.string().max(max);
const money=z.string().regex(/^\d{1,9}(?:\.\d{1,2})?$/,"กรอกจำนวนเงินไม่ติดเครื่องหมายคั่นหลักพัน");
const quantity=z.string().regex(/^\d{1,6}(?:\.\d{1,3})?$/).refine(v=>Number(v)>0,"จำนวนต้องมากกว่าศูนย์");
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v&&+v.slice(0,4)>=1900&&+v.slice(0,4)<2200;},"ระบุวันที่ ค.ศ. ที่ถูกต้อง");
export const signerRoles=["ผู้เสนอ / ผู้จัดทำ","ความเห็นผู้อำนวยการกอง","ความเห็นปลัดเทศบาล","คำสั่ง / ความเห็นผู้มีอำนาจ"] as const;
export const labDocumentSchema=z.object({
  kind:z.literal("D07"),mode:z.enum(["draft","source"]),selectedSourceId:z.string().uuid().nullable(),
  organization:text().trim().min(1),department:text(),phone:text(100),number:text(100),date,
  subject:text(300).trim().min(1),recipient:text(),vendorName:text().trim().min(1),
  background:text(40000),consideration:text(40000),proposal:text(10000),
  taxMode:z.enum(["included","excluded","none"]),taxRate:z.string().regex(/^\d{1,2}(?:\.\d{1,2})?$/).refine(v=>Number(v)<=25),
  lines:z.array(z.object({id:z.string().uuid(),name:text(1000).trim().min(1),unit:text(100).trim().min(1),quantity,offeredPrice:money,agreedPrice:money})).min(1).max(80),
  signers:z.array(z.object({name:text(300),position:text(600),opinion:text(1000)})).length(4),
  signingLayout:z.enum(["staggered","columns"]),
}).superRefine((d,c)=>{if(new Set(d.lines.map(l=>l.id)).size!==d.lines.length)c.addIssue({code:"custom",path:["lines"],message:"รหัสรายการซ้ำกัน"});});
export type LabDocument=z.infer<typeof labDocumentSchema>;
export type SavedLabDocument={id:string;version:number;data:LabDocument;updatedAt:string};
export type SourceFile={id:string;name:string;mime:string;bytes:number;sha256:string;createdAt:string;text?:string};
export type FieldValues=Record<string,string>;
export type FieldDefinition={key:string;label:string;value:string;kind:"text"|"money"|"quantity"|"date"|"multiline"};
export const thaiDigits=(v:string)=>v.replace(/[๐-๙]/g,c=>String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
export const normalizedText=(v:string)=>v.normalize("NFC").replace(/\r\n?/g,"\n").replace(/[\u200b\ufeff]/g,"").trim();
export const decimalCents=(v:string)=>{if(!money.safeParse(v).success)throw Error("จำนวนเงินไม่ถูกต้อง");const [a,b=""]=v.split(".");return BigInt(a)*100n+BigInt(b.padEnd(2,"0"));};
const roundDivide=(n:bigint,d:bigint)=>(n+d/2n)/d;
const lineTotal=(price:string,q:string)=>{const [a,b=""]=q.split(".");return roundDivide(decimalCents(price)*BigInt(a+b.padEnd(3,"0")),1000n);};
export function totals(d:LabDocument){
  const offered=d.lines.reduce((n,l)=>n+lineTotal(l.offeredPrice,l.quantity),0n),agreed=d.lines.reduce((n,l)=>n+lineTotal(l.agreedPrice,l.quantity),0n);
  const rate=decimalCents(d.taxRate),base=d.taxMode==="included"?roundDivide(agreed*10000n,10000n+rate):agreed;
  const tax=d.taxMode==="none"?0n:d.taxMode==="included"?agreed-base:roundDivide(base*rate,10000n);
  return {offered,base,tax,gross:base+tax};
}
export const formatMoney=(cents:bigint)=>{const s=cents.toString().padStart(3,"0");return s.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,",")+"."+s.slice(-2);};
const months=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
export function thaiDate(v:string){if(!date.safeParse(v).success)return v;const [y,m,d]=v.split("-").map(Number);return d+" "+months[m-1]+" "+(y+543);}
export function parseDate(v:string){const value=thaiDigits(normalizedText(v));if(date.safeParse(value).success)return value;const m=value.replace(/พ\.?\s*ศ\.?/g,"").match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);if(!m)return value;const month=months.indexOf(m[2])+1,year=Number(m[3])>2400?Number(m[3])-543:Number(m[3]);return year+"-"+String(month).padStart(2,"0")+"-"+m[1].padStart(2,"0");}
export function fieldDefinitions(d:LabDocument):FieldDefinition[]{
  const defs:FieldDefinition[]=[];
  const add=(key:string,label:string,value:string,kind:FieldDefinition["kind"]="text")=>defs.push({key,label,value,kind});
  for(const [key,label] of Object.entries({organization:"หน่วยงาน",department:"ส่วนราชการ",phone:"โทรศัพท์",number:"เลขหนังสือ",date:"วันที่",subject:"เรื่อง",recipient:"เรียน",vendorName:"ผู้ขาย",background:"เรื่องเดิม / ข้อเท็จจริง",consideration:"ผลการพิจารณา",proposal:"ข้อเสนอ",taxMode:"รูปแบบภาษี",taxRate:"อัตราภาษีที่ระบุ"})){
    add(key,label,d[key as keyof LabDocument] as string,key==="date"?"date":["background","consideration","proposal"].includes(key)?"multiline":"text");
  }
  d.lines.forEach((l,i)=>{for(const [key,label] of Object.entries({name:"รายการ",unit:"หน่วย",quantity:"จำนวน",offeredPrice:"ราคาต่อหน่วยที่เสนอ",agreedPrice:"ราคาต่อหน่วยที่ตกลง"}))add("line."+l.id+"."+key,"รายการ "+(i+1)+" · "+label,l[key as keyof typeof l],key.endsWith("Price")?"money":key==="quantity"?"quantity":"text");});
  d.signers.forEach((s,i)=>{for(const key of ["name","position","opinion"] as const)add("signer."+i+"."+key,signerRoles[i]+" · "+{name:"ชื่อ",position:"ตำแหน่ง",opinion:"ความเห็น"}[key],s[key],key==="name"?"text":"multiline");});
  return defs;
}
export const fieldValues=(d:LabDocument):FieldValues=>Object.fromEntries(fieldDefinitions(d).map(f=>[f.key,normalizeField(f,f.value)]));
export function normalizeField(f:FieldDefinition,value:string){
  let v=normalizedText(value);
  if(f.kind==="money"||f.kind==="quantity"||f.key==="taxRate")v=thaiDigits(v).replace(/[,\s]/g,"");
  if(f.kind==="money"&&/^\d+(?:\.\d{1,2})?$/.test(v)){const [a,b=""]=v.split(".");v=a.replace(/^0+(?=\d)/,"")+"."+b.padEnd(2,"0");}
  if((f.kind==="quantity"||f.key==="taxRate")&&/^\d+(?:\.\d+)?$/.test(v))v=v.replace(/^0+(?=\d)/,"").replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,"");
  if(f.key==="taxMode")v=({"รวมภาษีในราคา":"included","ไม่รวมภาษีในราคา":"excluded","ไม่มีภาษี":"none"} as Record<string,string>)[v]||v;
  if(f.kind==="date")v=parseDate(v);
  return v;
}
export function applyFields(d:LabDocument,values:FieldValues):LabDocument{
  const copy=structuredClone(d);
  for(const f of fieldDefinitions(d)){
    if(!(f.key in values))throw Error("ไม่ได้เลือกผลของช่อง "+f.label);
    const value=normalizeField(f,values[f.key]),parts=f.key.split(".");
    if(parts[0]==="line"){const line=copy.lines.find(l=>l.id===parts[1]);if(line)(line as unknown as Record<string,string>)[parts[2]]=value;}
    else if(parts[0]==="signer")(copy.signers[Number(parts[1])] as unknown as Record<string,string>)[parts[2]]=value;
    else (copy as unknown as Record<string,unknown>)[f.key]=value;
  }
  return labDocumentSchema.parse(copy);
}
export type DiffKind="same"|"system"|"word"|"matching"|"conflict"|"missing";
export type FieldDiff={key:string;label:string;base:string;ours:string;theirs:string|null;kind:DiffKind};
export type MergeChoice={choice:"ours"|"word"|"manual";value?:string};
export function compareFields(base:FieldValues,current:LabDocument,incoming:Record<string,string|null>):FieldDiff[]{
  return fieldDefinitions(current).map(f=>{
    const b=normalizeField(f,base[f.key]??""),o=normalizeField(f,f.value),t=incoming[f.key]===null||incoming[f.key]===undefined?null:normalizeField(f,incoming[f.key]!);
    const kind:DiffKind=t===null?"missing":o===b&&t===b?"same":o===t?"matching":o===b?"word":t===b?"system":"conflict";
    return {key:f.key,label:f.label,base:b,ours:o,theirs:t,kind};
  });
}
export function mergeFields(current:LabDocument,diffs:FieldDiff[],choices:Record<string,MergeChoice>){
  const values=fieldValues(current);
  for(const f of diffs){
    if(f.kind==="same"||f.kind==="matching")continue;
    const c=choices[f.key];if(!c)throw Error("เลือกผลของช่อง "+f.label);
    if(c.choice==="ours")continue;
    if(c.choice==="word"){if(f.theirs===null)throw Error("ช่องที่หายจาก Word ต้องคงค่าระบบหรือกรอกใหม่: "+f.label);values[f.key]=f.theirs;}
    else if(c.choice==="manual"&&typeof c.value==="string")values[f.key]=c.value;
    else throw Error("ผลเลือกไม่ถูกต้อง: "+f.label);
  }
  return applyFields(current,values);
}
export function sampleDocument(scenario:"short"|"long"|"longer"="short"):LabDocument{
  const paragraph="หน่วยงานได้ตรวจรายการ คุณลักษณะ จำนวน และเงื่อนไขการส่งมอบจากข้อเสนอที่ใช้ประกอบการพิจารณา โดยจัดเก็บหลักฐานไว้กับเรื่องนี้ เจ้าหน้าที่ต้องตรวจชื่อผู้ขาย ยอดเงิน และรายละเอียดให้ตรงกันก่อนนำเอกสารไปใช้งาน";
  return labDocumentSchema.parse({
    kind:"D07",mode:"draft",selectedSourceId:null,organization:"เทศบาลตัวอย่าง",department:"กองตัวอย่าง งานธุรการ",phone:"",number:"ทด 0001/007",date:"2026-11-15",
    subject:"รายงานผลการพิจารณาและขออนุมัติสั่งซื้อวัสดุสำนักงาน",recipient:"นายกเทศมนตรี",vendorName:"ร้านตัวอย่างเครื่องเขียน",
    background:scenario==="short"?"ตามการเสนอจัดซื้อวัสดุสำนักงาน จำนวน 2 รายการ เพื่อใช้ในการปฏิบัติงานของกองตัวอย่าง จึงขอรายงานผลการพิจารณาตามรายการดังต่อไปนี้":Array.from({length:scenario==="long"?8:16},()=>paragraph).join("\n"),
    consideration:"พิจารณารายการและราคาที่เสนอเทียบกับรายละเอียดที่ต้องการแล้ว เห็นสมควรเสนอผลการพิจารณาตามข้อมูลข้างต้น",
    proposal:"จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติสั่งซื้อจากผู้เสนอราคาที่ระบุไว้ในรายงานนี้",taxMode:"included",taxRate:"7",
    lines:[{id:"00000000-0000-4000-8000-000000000001",name:"กล่องพลาสติกอเนกประสงค์",unit:"ใบ",quantity:"2",offeredPrice:"500.00",agreedPrice:"500.00"},{id:"00000000-0000-4000-8000-000000000002",name:"ตลับเมตรวัดระยะ",unit:"ตลับ",quantity:"1",offeredPrice:"520.00",agreedPrice:"520.00"}],
    signers:[{name:"นายกิตติ ตัวอย่าง",position:"เจ้าพนักงานธุรการปฏิบัติงาน",opinion:""},{name:"นางมาลี ตัวอย่าง",position:"ผู้อำนวยการกอง",opinion:""},{name:"นายสมชาย ตัวอย่าง",position:"รองปลัดเทศบาล\nปฏิบัติราชการแทนปลัดเทศบาล",opinion:""},{name:"นายวิชัย ตัวอย่าง",position:"รองนายกเทศมนตรี\nปฏิบัติราชการแทนนายกเทศมนตรี",opinion:""}],signingLayout:"staggered",
  });
}
