vi.mock("@/lib/storage",()=>({mirrorLegal:vi.fn()}));
import { beforeAll,afterAll,it,expect,vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
vi.mock("@/lib/auth",()=>({requireUser:vi.fn(async()=>{})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/drive",()=>({uploadLibraryPdf:vi.fn(async()=>"test-drive-id")}));
import { db } from "../src/lib/db";
import { listLegalReferences,saveLegalReference,uploadLegalReference } from "../src/app/legal-actions";
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
