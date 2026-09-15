import { beforeAll,afterAll,it,expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db,auditHistory } from "../src/lib/db";
import { officeSchema,officeKinds } from "../src/lib/office";
import { writeOffice,listOffice,deleteOffice } from "../src/lib/office-db";
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-office-test-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(directory,"test.sqlite");});
afterAll(()=>db().close());
it("persists all office categories and records updates and deletion",()=>{
 for(const kind of Object.keys(officeKinds))writeOffice({kind,title:`ทดสอบ ${kind}`});
 expect(listOffice()).toHaveLength(7);
 const item=listOffice()[0];writeOffice({...item,notes:"ติดตามผลแล้ว"},item.id,item.version);
 expect(listOffice().find(i=>i.id===item.id)?.notes).toBe("ติดตามผลแล้ว");
 expect(()=>writeOffice({...item,title:"ข้อมูลเก่า"},item.id,1)).toThrow();
 expect(()=>deleteOffice(item.id,1)).toThrow();
 deleteOffice(item.id,2);expect(auditHistory(item.id)[0].action).toBe("office_delete");
 expect(listOffice()).toHaveLength(6);
});
it("rejects invalid dates, unsafe URLs, negative stock and nonexistent document links",()=>{
 expect(officeSchema.safeParse({kind:"task",title:"งาน",due:"2026-02-30"}).success).toBe(false);
 expect(officeSchema.safeParse({kind:"contact",title:"ผู้ติดต่อ",url:"javascript:alert(1)"}).success).toBe(false);
 expect(officeSchema.safeParse({kind:"supplies",title:"กระดาษ",quantity:-1}).success).toBe(false);
 expect(()=>writeOffice({kind:"task",title:"งาน",documentId:"00000000-0000-4000-8000-999999999999"})).toThrow();
});
