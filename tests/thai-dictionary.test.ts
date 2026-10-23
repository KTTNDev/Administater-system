import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db} from '../src/lib/db';
import {saveThaiTerm,listThaiTerms,deleteThaiTerm,getThaiKeepTerms} from '../src/lib/thai-dictionary-db';
import {thaiTermSchema,wordJoin} from '../src/lib/thai-dictionary';
import {analyzeThai,thaiLexicon} from '../src/lib/thai-proofread';
let root:string;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-thai-'));vi.stubEnv('DATABASE_PATH',path.join(root,'test.sqlite'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
it('persists edits, enforces uniqueness and rejects stale updates/deletes',()=>{
 const [first]=saveThaiTerm({word:'กล้องวีดิโอ',keepTogether:true,correction:''});expect(getThaiKeepTerms()).toContain(first.word);
 expect(()=>saveThaiTerm({word:first.word})).toThrow(/มีคำนี้/);
 const [second]=saveThaiTerm({word:'กล้องวีดิทัศน์',keepTogether:false},first.id,first.version);expect(second.version).toBe(2);expect(getThaiKeepTerms()).not.toContain(second.word);
 expect(()=>saveThaiTerm({word:'เก่า'},first.id,1)).toThrow(/แก้ไขแล้ว/);
 expect(()=>deleteThaiTerm(first.id,1)).toThrow();deleteThaiTerm(second.id,2);expect(listThaiTerms()).toEqual([]);
});
it('rejects unsafe or oversized phrases and identical replacements',()=>{
 for(const word of ['','ก'.repeat(81),'คำ\nใหม่','คำ\u2060ใหม่','<script>'])expect(thaiTermSchema.safeParse({word}).success).toBe(false);
 expect(thaiTermSchema.safeParse({word:'คำ',correction:'คำ'}).success).toBe(false);
});
it('loads the bundled offline dictionary and suggests known corrections without changing text',()=>{
 expect(thaiLexicon().size).toBeGreaterThan(60000);
 const text='ขออนุญาติ และสังเกตุข้อเท็จจริง';const r=analyzeThai(text,[]);
 expect(r.issues).toEqual(expect.arrayContaining([expect.objectContaining({word:'อนุญาติ',suggestions:['อนุญาต']}),expect.objectContaining({word:'สังเกตุ',suggestions:['สังเกต']})]));
 expect(text).toBe('ขออนุญาติ และสังเกตุข้อเท็จจริง');
 expect(analyzeThai(text,[{word:'อนุญาติ',keepTogether:false,correction:''}]).issues.some(i=>i.word==='อนุญาติ')).toBe(false);
});
it('uses staff corrections and preserves graphemes when exporting invisible word joiners',()=>{
 expect(analyzeThai('กฏหมาย', [{word:'กฏหมาย',keepTogether:true,correction:'กฎหมาย'}]).issues[0].suggestions).toEqual(['กฎหมาย']);
 const s='เครื่องปรับอากาศ';expect(wordJoin(s).replaceAll('\u2060','')).toBe(s);
 expect(wordJoin('กิ')).toBe('กิ');expect(wordJoin(s)).toContain('\u2060');
});
