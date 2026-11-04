import {expect,it} from 'vitest';
import {inlineBody,bodyEditorHtml,SOFT_BREAK} from '../src/lib/body-typography';
it('keeps manual line breaks inside paragraphs and headings separate',()=>{
 expect(bodyEditorHtml('หนึ่ง'+SOFT_BREAK+'สอง\n## หัวข้อ')).toBe('<p>หนึ่ง<br data-soft-break="true">สอง</p><h3>หัวข้อ</h3>');
});
it('escapes HTML and only allows bounded numeric tracking',()=>{
 expect(inlineBody('[space=-0.2]**ไทย**[/space]')).toContain('letter-spacing:-0.2pt"><strong>ไทย</strong>');
 expect(inlineBody('[space=99]<script>[/space]')).toBe('[space=99]&lt;script&gt;[/space]');
 expect(inlineBody('<img onerror="bad">')).not.toContain('<img');
});
it('parses markers before localizing displayed digits',()=>{
 expect(inlineBody('[space=-0.3]123[/space]',s=>s.replace(/1/g,'๑'))).toContain('letter-spacing:-0.3pt">๑23');
});
it('can reset tracking inside an already condensed phrase',()=>{
 const html=inlineBody('[space=-0.3]ก่อน[space=0]ปกติ[/space]หลัง[/space]');
 expect(html).toContain('letter-spacing:0pt">ปกติ</span>หลัง</span>');
 expect(html).not.toContain('[/space]');
});
it('supports bold both outside and inside tracked text',()=>{
 expect(inlineBody('**[space=-0.2]ไทย[/space]**')).toBe('<strong><span data-tracking="-0.2" style="letter-spacing:-0.2pt">ไทย</span></strong>');
});
