import { beforeAll,afterAll,it,expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db,setSetting,writeDraft } from "../src/lib/db";
import { newDraft } from "../src/lib/document";
import { setStorage,storageConfig,exportWorkspace,safeSegment,reportData } from "../src/lib/storage";
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-storage-test-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,"data.sqlite");});afterAll(()=>db().close());
it("validates local directory and Drive IDs without accepting relative paths",()=>{
 expect(()=>setStorage("relative/path","","")).toThrow();expect(()=>setStorage(path.parse(folder).root,"","")).toThrow();expect(()=>setStorage(path.join(folder,"files"),"invalid","")).toThrow();
 setStorage(path.join(folder,"files"),"1234567890abc","");expect(storageConfig().localFolder).toBe(path.join(folder,"files"));expect(safeSegment("../../" )).not.toContain("/");
});
it("exports business records and PDF bytes with hashes but excludes settings and credentials",()=>{
 setSetting("google:token","DO_NOT_EXPORT");writeDraft({...newDraft(),subject:"สำรองตัวอย่าง"});const c=db();c.exec("CREATE TABLE IF NOT EXISTS legal_library(id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL)");c.prepare("INSERT INTO legal_library VALUES(?,?,?,?,?)").run("sample-law",JSON.stringify({title:"ตัวอย่าง"}),Buffer.from("%PDF-test"),"sample.pdf",new Date().toISOString());
 const result=exportWorkspace();const manifest=JSON.parse(fs.readFileSync(path.join(result.folder,"manifest.json"),"utf8"));expect(manifest.counts.documents).toBe(1);expect(reportData().audit.every(row=>Object.getPrototypeOf(row)===Object.prototype)).toBe(true);expect(fs.readFileSync(path.join(result.folder,"sample-law.pdf"),"utf8")).toBe("%PDF-test");
 const json=fs.readdirSync(result.folder).filter(f=>f.endsWith(".json")).map(f=>fs.readFileSync(path.join(result.folder,f),"utf8")).join("");expect(json).not.toContain("DO_NOT_EXPORT");expect(json).not.toContain('"file":');expect(manifest.files.every((f:{sha256:string})=>f.sha256.length===64)).toBe(true);
});
