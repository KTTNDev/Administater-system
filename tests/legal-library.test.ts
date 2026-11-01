vi.mock("@/lib/storage",()=>({mirrorLegal:vi.fn()}));
import { beforeAll,afterAll,it,expect,vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
vi.mock("@/lib/auth",()=>({requireUser:vi.fn(async()=>{})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/drive",()=>({uploadLibraryPdf:vi.fn(async()=>"test-drive-id")}));
import { db } from "../src/lib/db";
import { listLegalReferences,saveLegalReference,uploadLegalReference,deleteLegalReference } from "../src/app/legal-actions";
import {legalTree,legalAncestors,legalDescendants,legalSchema} from "../src/lib/legal";
import {randomUUID} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {exportDatabase} from "../scripts/workspace-backup.mjs";
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-law-test-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(directory,"test.sqlite");});
afterAll(()=>db().close());
function form(values:Record<string,string>,pdf=false){const f=new FormData();for(const [k,v] of Object.entries({title:"ระเบียบทดสอบ",url:"",notes:"ใช้ประกอบงาน",section:"ข้อ 12",...values}))f.set(k,v);if(pdf)f.set("file",new File(["%PDF-1.4 test fixture"],"sample.pdf",{type:"application/pdf"}));return f;}
it("preserves categorization and PDF during edits from the older drafting form",async()=>{
 const id=await saveLegalReference(form({category:"งานสารบรรณ",tags:"เอกสาร, ประชุม",highlight:"ข้อควรจำ",page:"2"},true));
 await saveLegalReference(form({id,notes:"แก้เฉพาะโน้ต"}));
 const item=(await listLegalReferences()).find(x=>x.id===id)!;
 expect(item.category).toBe("งานสารบรรณ");expect(item.highlight).toBe("ข้อควรจำ");expect(item.fileName).toBe("sample.pdf");
 await saveLegalReference(form({id,updatedAt:item.updatedAt,notes:"ใหม่"}));
 await expect(saveLegalReference(form({id,updatedAt:item.updatedAt,notes:"เก่า"}))).rejects.toThrow("รายการเปลี่ยนแล้ว");
});
it("rejects invalid file, page and unsafe source URL",async()=>{
 const f=form({});f.set("file",new File(["not pdf"],"sample.pdf"));await expect(saveLegalReference(f)).rejects.toThrow("PDF");
 await expect(saveLegalReference(form({page:"0"}))).rejects.toThrow();
 await expect(saveLegalReference(form({url:"javascript:alert(1)"}))).rejects.toThrow();
});
it("records successful upload only after service success and clears stale link after replacement",async()=>{
 const id=await saveLegalReference(form({},true));await uploadLegalReference(id);
 expect((await listLegalReferences()).find(x=>x.id===id)?.driveFileId).toBe("test-drive-id");
 await saveLegalReference(form({id},true));expect((await listLegalReferences()).find(x=>x.id===id)?.driveFileId).toBe("");
 const noFile=await saveLegalReference(form({}));await expect(uploadLegalReference(noFile)).rejects.toThrow("แนบ PDF");
});

it("keeps legacy records as roots and preserves links/PDF when the older form omits new fields",async()=>{
 const root=await saveLegalReference(form({title:"ระเบียบตั้งต้น",category:"พัสดุและจัดซื้อจัดจ้าง",year:"2560"}));
 const child=await saveLegalReference(form({title:"ประกาศเพิ่มเติม",parentId:root,relationship:"notice",year:"2565"},true));
 await saveLegalReference(form({id:child,notes:"เพิ่มโน้ตจากหน้าร่าง"}));
 const items=await listLegalReferences(),record=items.find(x=>x.id===child)!;
 expect(record.parentId).toBe(root);expect(record.relationship).toBe("notice");expect(record.fileName).toBe("sample.pdf");
 expect(items.find(x=>x.id===root)?.parentId).toBe("");
 const data={...record} as Record<string,unknown>;delete data.parentId;delete data.relationship;
 expect(legalSchema.parse(data).parentId).toBe("");
});

it("supports multiple levels, rejects cycles/missing parents, and moves a whole branch safely",async()=>{
 const root=await saveLegalReference(form({title:"หลัก A"}));
 const other=await saveLegalReference(form({title:"หลัก B"}));
 const child=await saveLegalReference(form({title:"เพิ่มเติม A",parentId:root,relationship:"amendment"}));
 const grandchild=await saveLegalReference(form({title:"ซักซ้อม A",parentId:child,relationship:"guidance"}));
 await expect(saveLegalReference(form({id:root,parentId:grandchild}))).rejects.toThrow("ตัวเอง");
 await expect(saveLegalReference(form({id:child,parentId:child}))).rejects.toThrow("ตัวเอง");
 await expect(saveLegalReference(form({parentId:randomUUID()}))).rejects.toThrow("ไม่พบเอกสารต้นทาง");
 expect((await deleteLegalReference(root)).ok).toBe(false);
 expect((await deleteLegalReference(child)).ok).toBe(false);
 const before=(await listLegalReferences()).find(x=>x.id===child)!;
 await saveLegalReference(form({id:child,updatedAt:before.updatedAt,parentId:other}));
 await expect(saveLegalReference(form({id:child,updatedAt:before.updatedAt,parentId:root}))).rejects.toThrow("รายการเปลี่ยนแล้ว");
 const items=await listLegalReferences();
 expect(legalAncestors(grandchild,items).map(x=>x.id)).toEqual([other,child]);
 expect([...legalDescendants(other,items)]).toEqual([child,grandchild]);
 expect((await deleteLegalReference(root)).ok).toBe(true);
 await saveLegalReference(form({id:child,parentId:""}));
 const detached=(await listLegalReferences()).find(x=>x.id===child)!;
 expect(detached.parentId).toBe("");expect(detached.relationship).toBe("related");
 expect(legalAncestors(grandchild,await listLegalReferences()).map(x=>x.id)).toEqual([child]);
});

it("orders child editions by year and keeps malformed imported records accessible",async()=>{
 const base=legalSchema.parse({title:"ฉบับ",url:"",section:"",notes:""});
 const make=(id:string,parentId:string,year="")=>({...base,id,parentId,year,fileName:null,updatedAt:"2026-11-01"});
 const tree=legalTree([make("root",""),make("late","root","2569"),make("early","root","2562"),make("orphan","missing"),make("cycle-a","cycle-b"),make("cycle-b","cycle-a")]);
 expect(tree.find(x=>x.record.id==="root")?.children.map(x=>x.record.id)).toEqual(["early","late"]);
 const all:string[]=[];const walk=(nodes:ReturnType<typeof legalTree>)=>{for(const node of nodes){all.push(node.record.id);walk(node.children);}};walk(tree);
 expect(new Set(all).size).toBe(6);expect(all).toHaveLength(6);
});

it("includes hierarchy and original PDFs in the normal portable database backup",async()=>{
 const root=await saveLegalReference(form({title:"หลักสำหรับสำรอง"}));
 const child=await saveLegalReference(form({title:"ฉบับเพิ่มเติมสำหรับสำรอง",parentId:root,relationship:"supplement"},true));
 const exported=exportDatabase(path.join(directory,"test.sqlite"),path.join(directory,"backups"),process.cwd());
 const backup=new DatabaseSync(path.join(exported.folder,"sarabun.sqlite"),{readOnly:true});
 try {
  const row=backup.prepare("SELECT data,file FROM legal_library WHERE id=?").get(child)!;
  expect(JSON.parse(String(row.data)).parentId).toBe(root);
  expect(JSON.parse(String(row.data)).relationship).toBe("supplement");
  expect(Buffer.from(row.file as Uint8Array).toString()).toBe("%PDF-1.4 test fixture");
 } finally {backup.close();}
});
