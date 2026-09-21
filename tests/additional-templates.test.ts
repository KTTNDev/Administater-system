import {it,expect} from 'vitest';
import {documentSchema,newDraft} from '../src/lib/document';
import {documentHtml} from '../src/lib/render-document';
const assets={regular:'data:font/ttf;base64,',bold:'data:font/ttf;base64,',garuda:'data:image/png;base64,'};
it('preserves legacy defaults and validates optional first-page margins',()=>{
 expect(documentSchema.parse({type:'internal',date:'2026-09-21',subject:'เดิม'}).firstPageTop).toBe('15');
 expect(documentSchema.safeParse({...newDraft(),firstPageTop:'99'}).success).toBe(false);
});
it('adds the regulation subject and edition and only renders received-order authority on orders',()=>{
 const regulation=documentHtml({...newDraft('regulation'),subject:'การปฏิบัติงาน',number:'2'},assets);expect(regulation).toContain('ว่าด้วย การปฏิบัติงาน');expect(regulation).toContain('(ฉบับที่ 2)');
 const order={...newDraft('order'),orderReceivedBy:'นายกเทศมนตรี'};expect(documentHtml(order,assets)).toContain('รับคำสั่งนายกเทศมนตรี');expect(documentHtml({...order,type:'external'},assets)).not.toContain('รับคำสั่งนายกเทศมนตรี');
});
