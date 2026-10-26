import { beforeAll,afterAll,it,expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db,setSetting,writeDraft,readDraft } from "../src/lib/db";
import { appendixSources,createAppendixImage,readAppendixImage,validateAppendixImages } from "../src/lib/appendix";
import { newDraft } from "../src/lib/document";
import { exportWorkspace } from "../src/lib/storage";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-appendix-"));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(dir,"test.sqlite");setSetting("storage:local",path.join(dir,"files"));});
afterAll(()=>db().close());
it("stores image bytes and dimensions, persists draft metadata, and includes images in backups",async()=>{
 const original=fs.readFileSync("public/assets/garuda.png"),stored=await createAppendixImage(new File([new Uint8Array(original)],"evidence.png",{type:"image/png"}));
 const {source,...image}=stored,draft={...newDraft("external"),appendixTitle:"ภาพหลักฐาน",appendixImages:[image]};validateAppendixImages(draft);
 expect(readAppendixImage(image.id).file).toEqual(original);expect(appendixSources(draft)[image.id]).toBe(source);
 const saved=writeDraft(draft);expect(readDraft(saved.id).appendixImages[0]).toMatchObject({id:image.id,width:image.width,height:image.height,caption:""});
 const backup=exportWorkspace();expect(fs.readFileSync(path.join(backup.folder,image.id+".png"))).toEqual(original);
},30000);
it("rejects fake image data and unsupported image types",async()=>{
 await expect(createAppendixImage(new File(["not an image"],"bad.png",{type:"image/png"}))).rejects.toThrow();
 await expect(createAppendixImage(new File(["not an image"],"bad.gif",{type:"image/gif"}))).rejects.toThrow();
});
