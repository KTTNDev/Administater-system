import {afterAll,beforeAll,describe,expect,it} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import JSZip from "jszip";
import {sampleDocument,totals,formatMoney,fieldValues,compareFields,mergeFields,thaiDate} from "../src/lib/procurement-lab/model";
import {makeLabWord,parseLabWord} from "../src/lib/procurement-lab/word";
import {LAB_MARKER,closeLabDb,createLabSample,saveLabDocument,readLabDocument,hashFields,recordLabExport,readLabExport,createLabReview,applyLabReview,addLabSource,labSourceFiles,readLabBinary} from "../src/lib/procurement-lab/store";

describe("procurement data and round trip",()=>{
  it("rounds cents deterministically and does not apply tax twice",()=>{
    const d=sampleDocument();expect(formatMoney(totals(d).gross)).toBe("1,520.00");expect(formatMoney(totals(d).base)).toBe("1,420.56");expect(formatMoney(totals(d).tax)).toBe("99.44");
    d.taxMode="excluded";expect(formatMoney(totals(d).gross)).toBe("1,626.40");d.taxMode="none";expect(formatMoney(totals(d).gross)).toBe("1,520.00");
    d.lines=[{...d.lines[0],quantity:"0.005",agreedPrice:"1.00",offeredPrice:"1.00"}];expect(totals(d).gross).toBe(1n);
  });
  it("normalizes Thai dates and numerals before comparing and requires a conflict choice",()=>{
    const d=sampleDocument(),base=fieldValues(d),incoming:Record<string,string>={...base,date:thaiDate(d.date),"line.00000000-0000-4000-8000-000000000001.agreedPrice":"๕๐๐.๐๐"};
    expect(compareFields(base,d,incoming).every(f=>f.kind==="same")).toBe(true);
    incoming.vendorName="ร้านจาก Word";d.vendorName="ร้านจากระบบ";const diffs=compareFields(base,d,incoming);expect(diffs.find(f=>f.key==="vendorName")?.kind).toBe("conflict");
    expect(()=>mergeFields(d,diffs,{})).toThrow();expect(mergeFields(d,diffs,{vendorName:{choice:"word"}}).vendorName).toBe("ร้านจาก Word");
    expect(d.vendorName).toBe("ร้านจากระบบ");
  });
  it("keeps editable Word field identity and detects deleted or duplicated controls",async()=>{
    const d=sampleDocument(),meta={format:"sarabun-procurement/1" as const,documentId:randomUUID(),exportId:randomUUID(),baseHash:hashFields(fieldValues(d))};
    const built=await makeLabWord(d,meta),parsed=await parseLabWord(built.bytes);expect(parsed.meta).toEqual(meta);expect(compareFields(fieldValues(d),d,parsed.fields).every(f=>f.kind==="same")).toBe(true);
    const zip=await JSZip.loadAsync(built.bytes);let main=await zip.file("word/document.xml")!.async("string");main=main.replace("sarabun:vendorName","removed:vendorName");zip.file("word/document.xml",main);const missing=await parseLabWord(await zip.generateAsync({type:"nodebuffer"}));expect(compareFields(fieldValues(d),d,missing.fields).find(f=>f.key==="vendorName")?.kind).toBe("missing");
    zip.file("word/document.xml",main.replace("sarabun:recipient","sarabun:subject"));await expect(parseLabWord(await zip.generateAsync({type:"nodebuffer"}))).rejects.toThrow("ซ้ำ");
  });
});

describe("isolated persistence and merge",()=>{
  let root:string;const prior={enabled:process.env.SARABUN_PROCUREMENT_LAB,root:process.env.SARABUN_PROCUREMENT_LAB_ROOT};
  beforeAll(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),"sarabun-procurement-test-"));fs.writeFileSync(path.join(root,"SAFETY-TEST-ONLY"),LAB_MARKER);process.env.SARABUN_PROCUREMENT_LAB="true";process.env.SARABUN_PROCUREMENT_LAB_ROOT=root;});
  afterAll(()=>{closeLabDb();if(prior.enabled===undefined)delete process.env.SARABUN_PROCUREMENT_LAB;else process.env.SARABUN_PROCUREMENT_LAB=prior.enabled;if(prior.root===undefined)delete process.env.SARABUN_PROCUREMENT_LAB_ROOT;else process.env.SARABUN_PROCUREMENT_LAB_ROOT=prior.root;});
  it("persists evidence and mode switches without destroying either version",()=>{
    const d=createLabSample(),sourceId=randomUUID(),bytes=Buffer.from("unchanged original evidence");addLabSource(d.id,{id:sourceId,name:"test.pdf",mime:"application/pdf",bytes,text:""});addLabSource(d.id,{id:sourceId,name:"test.pdf",mime:"application/pdf",bytes,text:""});expect(labSourceFiles(d.id)).toHaveLength(1);
    const v2=saveLabDocument(d.id,1,{...d.data,mode:"source",selectedSourceId:sourceId});const v3=saveLabDocument(d.id,2,{...v2.data,mode:"draft"});expect(v3.data.background).toBe(d.data.background);expect(readLabBinary(sourceId).bytes.equals(bytes)).toBe(true);expect(()=>saveLabDocument(d.id,1,d.data)).toThrow("เปลี่ยน");
    const other=createLabSample();expect(()=>saveLabDocument(other.id,1,{...other.data,selectedSourceId:sourceId})).toThrow("ไม่ใช่");closeLabDb();expect(readLabDocument(d.id).version).toBe(3);
  });
  it("uses persisted export baseline and saves a reviewed merge only once",async()=>{
    const d=createLabSample(),exportId=randomUUID(),base=fieldValues(d.data),baseHash=hashFields(base);const built=await makeLabWord(d.data,{format:"sarabun-procurement/1",documentId:d.id,exportId,baseHash});recordLabExport({id:exportId,documentId:d.id,version:1,base,baseHash,outsideText:built.outsideText},built.bytes);
    closeLabDb();expect(readLabExport(exportId).base).toEqual(base);
    const incoming={...base,vendorName:"ร้านเปลี่ยน"},review=createLabReview(d.id,{exportId,oursVersion:1,exportVersion:1,diffs:compareFields(base,d.data,incoming),unmapped:["ข้อความเพิ่มนอกช่อง"],warnings:[],name:"returned.docx"},built.bytes,randomUUID());
    expect(readLabDocument(d.id).version).toBe(1);expect(()=>applyLabReview(d.id,review.id,{vendorName:{choice:"word"}},false)).toThrow("ตรวจส่วน");
    expect(applyLabReview(d.id,review.id,{vendorName:{choice:"word"}},true).document.data.vendorName).toBe("ร้านเปลี่ยน");expect(applyLabReview(d.id,review.id,{vendorName:{choice:"word"}},true).alreadyApplied).toBe(true);expect(readLabDocument(d.id).version).toBe(2);
  });
  it("refuses a review when the system changed after comparison",()=>{
    const d=createLabSample(),exportId=randomUUID(),base=fieldValues(d.data);recordLabExport({id:exportId,documentId:d.id,version:1,base,baseHash:hashFields(base),outsideText:[]},Buffer.from("test"));
    const review=createLabReview(d.id,{exportId,oursVersion:1,exportVersion:1,diffs:compareFields(base,d.data,{...base,subject:"new"}),unmapped:[],warnings:[],name:"returned.docx"},Buffer.from("test"),randomUUID());saveLabDocument(d.id,1,{...d.data,subject:"system changed"});expect(()=>applyLabReview(d.id,review.id,{subject:{choice:"word"}},true)).toThrow("เทียบ Word ใหม่");
  });
});
