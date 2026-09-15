import { describe,it,expect } from "vitest";
import { documentSchema,newDraft,numerals,bodySections,reviewIssues } from "../src/lib/document";
import { documentHtml } from "../src/lib/render-document";
const assets={regular:"data:font/ttf;base64,123",bold:"data:font/ttf;base64,123",garuda:"data:image/png;base64,123"};
describe("extended drafting tools",()=>{
 it("loads historical drafts without dropping their body",()=>{const d=documentSchema.parse({type:"internal",subject:"เดิม",date:"2026-09-09",body:"เดิม 123"});expect(d.opinions).toEqual([]);expect(d.copyMark).toBe("none");expect(bodySections(d)[0].text).toBe("เดิม 123")});
 it("converts mixed numerals reversibly without changing punctuation",()=>{expect(numerals("12/๒๕๖๙","thai")).toBe("๑๒/๒๕๖๙");expect(numerals("๑๒/2569","arabic")).toBe("12/2569")});
 it("renders structured content and preserves inactive free text",()=>{const d={...newDraft(),body:"OLD_BODY",bodyMode:"structured" as const,legalBasis:"ข้อ 12"};expect(reviewIssues(d)).not.toContain("ระบุเนื้อหาหนังสือ");const html=documentHtml(d,assets);expect(html).toContain("ข้อ 12");expect(html).not.toContain("OLD_BODY");expect(d.body).toBe("OLD_BODY")});
 it("keeps font data and email intact when converting document numerals",()=>{const html=documentHtml({...newDraft(),number:"12/2569",email:"office123@example.com",numeralStyle:"thai"},assets);expect(html).toContain("๑๒/๒๕๖๙");expect(html).toContain("office123@example.com");expect(html).toContain(assets.regular)});
 it("limits opinions and escapes all opinion and stamp names",()=>{const item={title:"<script>bad</script>",comment:"",name:"",position:"",lines:3};expect(documentSchema.safeParse({...newDraft(),opinions:Array(6).fill(item)}).success).toBe(false);const d=documentSchema.parse({...newDraft("internal"),opinions:[item],productionMark:true,drafter:"<img src=x>"});const html=documentHtml(d,assets);expect(html).toContain("&lt;script&gt;bad");expect(html).not.toContain("<script>bad");expect(html).toContain("&lt;img src=x&gt;")});
});
