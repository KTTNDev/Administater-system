import {it,expect} from 'vitest';
import {documentSample} from '../src/lib/document-samples';
import {newDraft,documentSchema,reviewIssues} from '../src/lib/document';
import {templates} from '../src/lib/templates';
it('provides distinct valid examples for all forms without inventing registration numbers',()=>{
 const subjects=new Set<string>();
 for(const template of templates){const draft=documentSample(newDraft(template.id));
  expect(documentSchema.safeParse(draft).success).toBe(true);expect(draft.number).toBe('');
  expect(draft.subject).toContain('ตัวอย่าง');subjects.add(draft.subject);
  expect(reviewIssues(draft).filter(issue=>!issue.includes('เลขที่หนังสือ'))).toEqual([]);
 }
 expect(subjects.size).toBe(templates.length);
});
it('preserves the office, number, date and attached documents while replacing hidden structured content',()=>{
 const before={...newDraft('internal'),number:'ทส 123/456',organization:'หน่วยงานจริง',bodyMode:'structured' as const,facts:'ข้อมูลเดิม',contentBlocks:[{kind:'paragraph' as const,label:'',text:'เนื้อหาเก่า'}],appendixPages:[{id:crypto.randomUUID(),title:'แนบเดิม',body:'ข้อความแนบเดิม'}]};
 const after=documentSample(before);expect(after.organization).toBe(before.organization);expect(after.number).toBe(before.number);expect(after.date).toBe(before.date);expect(after.appendixPages).toEqual(before.appendixPages);expect(after.bodyMode).toBe('free');expect(after.contentBlocks).toEqual([]);expect(after.facts).toBe('');
});
