import {it,expect,beforeAll,afterAll} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {db,writeDraft,readDraft,removeDraft,setSetting} from "../src/lib/db";
import {newDraft} from "../src/lib/document";
import {listSignedScans,readSignedScan,storeSignedScan} from "../src/lib/signed-scans";
import {exportWorkspace} from "../src/lib/storage";
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-scans-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,"scans.sqlite");setSetting("storage:local",path.join(folder,"files"))});
afterAll(()=>db().close());
it("keeps signed scans with the same draft, counts them, backs them up, and retains them in the trash",async()=>{
 const draft=writeDraft({...newDraft(),subject:"หนังสือทดสอบ"});
 const bytes=Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
 const item=await storeSignedScan(draft.id,new File([new Uint8Array(bytes)],"signed.pdf",{type:"application/pdf"}));
 expect(readSignedScan(item.id).file).toEqual(bytes);
 expect(listSignedScans(draft.id)).toHaveLength(1);
 expect(readDraft(draft.id).signedScanCount).toBe(1);
 const backup=exportWorkspace();expect(fs.readFileSync(path.join(backup.folder,item.id+"-signed.pdf"))).toEqual(bytes);
 removeDraft(draft.id,draft.version);expect(db().prepare("SELECT COUNT(*) n FROM signed_scans WHERE id=?").get(item.id)?.n).toBe(1);expect(()=>readSignedScan(item.id)).toThrow();
});
it("rejects invalid scans",async()=>{
 const draft=writeDraft({...newDraft(),subject:"ตรวจชนิดไฟล์"});
 await expect(storeSignedScan(draft.id,new File(["fake"],"fake.pdf",{type:"application/pdf"}))).rejects.toThrow();
});
