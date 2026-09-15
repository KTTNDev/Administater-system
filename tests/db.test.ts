import { beforeAll,afterAll,describe,expect,it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db,writeDraft,readDraft,listDrafts,removeDraft,auditHistory } from "../src/lib/db";
import { newDraft } from "../src/lib/document";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-db-test-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(dir,"test.sqlite")});
afterAll(()=>{db().close();fs.rmSync(dir,{recursive:true,force:true})});
describe("persistent CRUD",()=>{
 it("round-trips Thai text and maintains an audit trail",()=>{const d=writeDraft({...newDraft(),subject:"ทดสอบฐานข้อมูล",body:"ภาษาไทย ' \" <>&"});expect(readDraft(d.id).body).toBe(d.body);const updated=writeDraft({...d,subject:"แก้ไขแล้ว"},d.id,d.version);expect(updated.version).toBe(2);expect(auditHistory(d.id).map(h=>h.action)).toEqual(["update","create"]);expect(listDrafts()).toHaveLength(1);removeDraft(d.id,2);expect(listDrafts()).toHaveLength(0);expect(auditHistory(d.id)[0].action).toBe("delete")});
 it("prevents stale updates and stale deletions without altering the latest document",()=>{const d=writeDraft(newDraft());writeDraft({...d,body:"new content"},d.id,1);expect(()=>writeDraft({...d,body:"stale"},d.id,1)).toThrow();expect(()=>removeDraft(d.id,1)).toThrow();expect(readDraft(d.id).body).toBe("new content");removeDraft(d.id,2)});
});
