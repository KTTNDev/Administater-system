import { z } from "zod";
export const lawCategories=["งานสารบรรณ","การบริหารท้องถิ่น","บุคลากร","การเงินและงบประมาณ","พัสดุและจัดซื้อจัดจ้าง","ข้อมูลข่าวสารและดิจิทัล","บริการสาธารณะ","กฎหมายทั่วไป","อื่น ๆ"];
export const legalSchema=z.object({title:z.string().trim().min(1,"กรุณาระบุชื่อเอกสาร").max(300),url:z.union([z.literal(""),z.string().url().refine(v=>/^https?:\/\//i.test(v),"ใช้ลิงก์ http หรือ https")]),section:z.string().max(300),notes:z.string().max(10000),category:z.string().trim().min(1).max(100).default("อื่น ๆ"),tags:z.string().max(1000).default(""),year:z.string().regex(/^(\d{4})?$/,"ระบุปี พ.ศ. 4 หลัก หรือเว้นว่าง").default(""),status:z.enum(["unchecked","current","amended","repealed"]).default("unchecked"),parentId:z.union([z.literal(""),z.string().uuid()]).default(""),relationship:z.enum(["supplement","amendment","notice","guidance","repeal","related"]).default("related"),highlight:z.string().max(5000).default(""),page:z.coerce.number().int().min(1).max(100000).default(1),driveFileId:z.string().default(""),driveHash:z.string().default("")});
export type LegalRecord=z.infer<typeof legalSchema>&{id:string;fileName:string|null;updatedAt:string};
export const lawStatuses={unchecked:"ยังไม่ตรวจสอบสถานะ",current:"ตรวจแล้ว: ใช้บังคับ",amended:"มีฉบับแก้ไข",repealed:"ยกเลิกแล้ว"};

export const lawRelationships = {
 supplement: "เพิ่มเติม", amendment: "แก้ไขเพิ่มเติม", notice: "ประกาศ",
 guidance: "หนังสือเวียน / ซักซ้อม", repeal: "ยกเลิก", related: "เกี่ยวข้อง",
} as const;

type LegalLink = {id:string;parentId?:string};

/** Called inside the save transaction: a parent must exist and never form a cycle. */
export function validateLegalParent(id:string,parentId:string,items:LegalLink[]) {
 const byId=new Map(items.map(item=>[item.id,item]));
 const visited=new Set([id]);
 let cursor=parentId;
 while(cursor) {
  if(visited.has(cursor))throw new Error("เชื่อมโยงไม่ได้: เอกสารต้องไม่อยู่ใต้ตัวเองหรือเอกสารลูกของตัวเอง");
  visited.add(cursor);
  const item=byId.get(cursor);
  if(!item)throw new Error("ไม่พบเอกสารต้นทาง กรุณาโหลดคลังใหม่แล้วเลือกอีกครั้ง");
  cursor=item.parentId||"";
 }
}

export function legalDescendants(id:string,items:LegalLink[]):Set<string> {
 const children=new Map<string,string[]>();
 for(const item of items)if(item.parentId)children.set(item.parentId,[...(children.get(item.parentId)||[]),item.id]);
 const result=new Set<string>(),queue=[id];
 for(let i=0;i<queue.length;i++)for(const child of children.get(queue[i])||[]) {
  if(child===id||result.has(child))continue;
  result.add(child);queue.push(child);
 }
 return result;
}

/** Breadcrumbs are also used in the drafting form so similarly named editions stay distinct. */
export function legalAncestors(id:string,items:LegalRecord[]):LegalRecord[] {
 const byId=new Map(items.map(item=>[item.id,item])),result:LegalRecord[]=[],seen=new Set([id]);
 let cursor=byId.get(id)?.parentId;
 while(cursor&&!seen.has(cursor)) {
  seen.add(cursor);const item=byId.get(cursor);if(!item)break;
  result.unshift(item);cursor=item.parentId;
 }
 return result;
}

export type LegalNode={record:LegalRecord;children:LegalNode[]};
export function legalTree(items:LegalRecord[]):LegalNode[] {
 const nodes=new Map(items.map(record=>[record.id,{record,children:[]} as LegalNode]));
 const parents=new Map(items.map(item=>[item.id,nodes.has(item.parentId)&&item.parentId!==item.id?item.parentId:""]));
 // Keep imported orphan/cyclic records accessible, even when created by an older/external tool.
 for(const item of items) {
  let cursor=item.id;const seen=new Set<string>();
  while(cursor){if(seen.has(cursor)){parents.set(item.id,"");break;}seen.add(cursor);cursor=parents.get(cursor)||"";}
 }
 const roots:LegalNode[]=[];
 for(const node of nodes.values()){const parent=nodes.get(parents.get(node.record.id)||"");if(parent)parent.children.push(node);else roots.push(node);}
 for(const node of nodes.values())node.children.sort((a,b)=>Number(a.record.year||9999)-Number(b.record.year||9999)||a.record.updatedAt.localeCompare(b.record.updatedAt)||a.record.title.localeCompare(b.record.title,"th"));
 return roots;
}
