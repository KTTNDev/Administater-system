import {afterAll,beforeAll,describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {DOMParser} from "@xmldom/xmldom";
import {templateInitial,fillD07Template,D07_REFERENCE_SHA256,readTemplateArtifact,blackReminderText} from "../src/lib/procurement-lab/template";
import {hashBytes} from "../src/lib/procurement-lab/store";
const root=path.resolve("output/procurement-lab"),available=fs.existsSync(path.join(root,"template-d07/reference.docx"));
describe.skipIf(!available)("D07 fidelity using retained private reference (prepare with audit-procurement-template.py)",()=>{
  const prior={enabled:process.env.SARABUN_PROCUREMENT_LAB,root:process.env.SARABUN_PROCUREMENT_LAB_ROOT};
  beforeAll(()=>{process.env.SARABUN_PROCUREMENT_LAB="true";process.env.SARABUN_PROCUREMENT_LAB_ROOT=root;});
  afterAll(()=>{if(prior.enabled===undefined)delete process.env.SARABUN_PROCUREMENT_LAB;else process.env.SARABUN_PROCUREMENT_LAB=prior.enabled;if(prior.root===undefined)delete process.env.SARABUN_PROCUREMENT_LAB_ROOT;else process.env.SARABUN_PROCUREMENT_LAB_ROOT=prior.root;});
  it("changes reminder red to black while preserving the retained reference",async()=>{
    const initial=await templateInitial(),built=await fillD07Template(initial.values),reference=fs.readFileSync(path.join(root,"template-d07/reference.docx"));expect(hashBytes(reference)).toBe(D07_REFERENCE_SHA256);expect(built.changed).toEqual([]);
    const before=await JSZip.loadAsync(reference),after=await JSZip.loadAsync(built.bytes),a=await before.file("word/document.xml")!.async("string"),b=await after.file("word/document.xml")!.async("string");expect(a).toContain('w:val="FF0000"');expect(b).not.toContain('w:val="FF0000"');expect(b).toBe(blackReminderText(a));
  },20000);
  it("changes only text, preserves all other package parts and both drawing fallback names",async()=>{
    const initial=await templateInitial(),built=await fillD07Template({...initial.values,vendor:"ร้านตัวอย่างทดสอบ",number:"ภก 52906/001",director:"นางทดสอบ รักษาแบบ",authority:"นายทดสอบ แบบเดิม",secretary:"นายทดสอบ ต้นฉบับ",agreed:"2,140.00"});
    const original=await JSZip.loadAsync(fs.readFileSync(path.join(root,"template-d07/reference.docx"))),output=await JSZip.loadAsync(built.bytes);
    expect(Object.keys(output.files).sort()).toEqual(Object.keys(original.files).sort());
    for(const name of Object.keys(original.files))if(name!=="word/document.xml")expect(await output.file(name)!.async("uint8array")).toEqual(await original.file(name)!.async("uint8array"));
    const a=await original.file("word/document.xml")!.async("string"),b=await output.file("word/document.xml")!.async("string"),mask=(s:string)=>s.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,"$1$2");expect(mask(b)).toBe(mask(blackReminderText(a)));
    expect(b.split("นางทดสอบ รักษาแบบ").length-1).toBe(2);expect(b).toContain("2,000.00");expect(b).toContain("140.00");
    const doc=new DOMParser().parseFromString(b,"application/xml"),texts=Array.from(doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main","p")).map(p=>p.textContent);
    expect(texts.filter(p=>p===" (นายทดสอบ แบบเดิม)")).toHaveLength(2);expect(texts.filter(p=>p==="(นายทดสอบ ต้นฉบับ)")).toHaveLength(2);
  },20000);
  it("escapes user text and rejects invalid dates, new paragraphs, unknown fields and traversal",async()=>{
    const initial=await templateInitial();const built=await fillD07Template({...initial.values,vendor:"ร้าน A & B <ทดลอง>"});const zip=await JSZip.loadAsync(built.bytes);expect(await zip.file("word/document.xml")!.async("string")).toContain("A &amp; B &lt;ทดลอง&gt;");
    await expect(fillD07Template({...initial.values,day:"31",month:"กุมภาพันธ์"})).rejects.toThrow("วันที่");await expect(fillD07Template({...initial.values,proposal:"บรรทัดแรก\nบรรทัดใหม่"})).rejects.toThrow();await expect(fillD07Template({...initial.values,extra:"unexpected"})).rejects.toThrow();expect(()=>readTemplateArtifact("../reference","docx")).toThrow();
  },20000);
});
