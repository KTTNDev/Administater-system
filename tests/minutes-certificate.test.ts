import {it,expect} from 'vitest';
import {bodySections,documentSchema,newDraft,reviewIssues} from '../src/lib/document';
import {documentHtml} from '../src/lib/render-document';
const assets={regular:'data:font/ttf;base64,',bold:'data:font/ttf;base64,',garuda:'data:image/png;base64,'};
it('keeps legacy reports and switches agenda content without destroying free text',()=>{
 const old=documentSchema.parse({type:'minutes',subject:'ประชุม',date:'2026-09-25',body:'ข้อความเดิม'});
 expect(old.minutesMode).toBe('free');expect(old.certificatePhotoArea).toBe(false);
 const draft={...old,minutesMode:'agenda' as const,sectionHeadings:false,meetingAgenda:[{title:'งบประมาณ',discussion:'อภิปราย <script>',resolution:'รับทราบ',resolutionLabel:'ข้อสรุป' as const}]};
 const html=documentHtml(draft,assets);
 expect(html).toContain('ระเบียบวาระที่ 1  งบประมาณ');expect(html).toContain('อภิปราย &lt;script&gt;');expect(html).toContain('ข้อสรุป');expect(html).not.toContain('ข้อความเดิม');
 expect(bodySections({...draft,minutesMode:'free'})[0].text).toBe('ข้อความเดิม');
 expect(reviewIssues(draft)).not.toContain('ระบุเนื้อหาหนังสือ');
 expect(reviewIssues({...draft,meetingAgenda:[]})).toContain('เพิ่มอย่างน้อยหนึ่งวาระการประชุม');
 expect(documentSchema.safeParse({...draft,meetingAgenda:Array(51).fill(draft.meetingAgenda[0])}).success).toBe(false);
});
it('only prints certificate photo and recipient block when requested on a certificate',()=>{
 const draft={...newDraft('certificate'),certificatePhotoArea:true,certificateRecipient:'ผู้รับการรับรอง'};
 expect(documentHtml(draft,assets)).toContain('<div class="certificate-photo">');
 expect(documentHtml({...draft,certificatePhotoArea:false},assets)).not.toContain('<div class="certificate-photo">');
 expect(documentHtml({...draft,type:'external'},assets)).not.toContain('<div class="certificate-photo">');
 expect(reviewIssues({...draft,certificateRecipient:''})).toContain('ระบุชื่อผู้ได้รับการรับรองใต้ช่องรูปถ่าย');
});
