import { describe,expect,it } from "vitest";
import { documentSchema,documentYear,newDraft,reviewIssues,thaiDate } from "../src/lib/document";
import { documentHtml } from "../src/lib/render-document";
import { groups,templates } from "../src/lib/templates";
const assets={regular:"data:font/ttf;base64,",bold:"data:font/ttf;base64,",garuda:"data:image/png;base64,"};
describe("Thai correspondence",()=>{
  it("covers 6 categories and 13 subtypes",()=>{expect(groups).toHaveLength(6);expect(templates).toHaveLength(13)});
  it("uses document date and handles the October fiscal boundary",()=>{expect(documentYear("2026-09-30","fiscal")).toBe(2569);expect(documentYear("2026-10-01","fiscal")).toBe(2570);expect(documentYear("2026-12-31","calendar")).toBe(2569);expect(documentYear("2027-01-01","calendar")).toBe(2570)});
  it("rejects impossible dates and Buddhist years entered as Gregorian",()=>{expect(documentSchema.safeParse({...newDraft(),date:"2026-02-30"}).success).toBe(false);expect(documentSchema.safeParse({...newDraft(),date:"2569-09-08"}).success).toBe(false);expect(documentSchema.safeParse({...newDraft(),date:"2024-02-29"}).success).toBe(true)});
  it("formats a stable Bangkok Buddhist date",()=>{expect(thaiDate("2026-09-08")).toBe("8 กันยายน 2569")});
  it("validates required meeting fields independently of letters",()=>{const d=newDraft("minutes"),issues=reviewIssues(d).join(" ");expect(issues).toContain("ผู้จดรายงาน");expect(issues).toContain("สถานที่");expect(issues).not.toContain("ผู้รับหนังสือ")});
  it("escapes user content and prevents script injection",()=>{const html=documentHtml({...newDraft(),subject:'<script>alert(1)</script>',body:'<img src=x onerror="alert(1)"> & ข้อความ'},assets);expect(html).not.toContain('<script>alert(1)</script>');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;img');expect(html).toContain('&amp;')});
  it("keeps reference and attachment fields out of internal memo headings",()=>{const d={...newDraft("internal"),reference:"REFERENCE_MARKER",attachments:"ATTACHMENT_MARKER"};const html=documentHtml(d,assets);expect(html).toContain("บันทึกข้อความ");expect(html).not.toContain("REFERENCE_MARKER");expect(html).not.toContain("ATTACHMENT_MARKER")});
  it("renders distinct stamped and order structures",()=>{const stamped=documentHtml({...newDraft("stamped"),recipient:"TEST_RECIPIENT",closing:"CLOSING_MARKER"},assets);expect(stamped).toContain("ถึง");expect(stamped).toContain("TEST_RECIPIENT");expect(stamped).not.toContain("CLOSING_MARKER");expect(documentHtml(newDraft("order"),assets)).toContain("สั่ง ณ วันที่")});
});
