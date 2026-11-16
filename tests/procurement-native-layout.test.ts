import {it,expect} from 'vitest';
import {printedPageTexts} from '../src/lib/procurement-native-layout';
it('uses the main story for a single printed page despite wrapped virtual Word pages',()=>{
 expect(printedPageTexts({pageTexts:['ส่วนลงนาม','หัวเรื่องและเนื้อหา'],mainText:'หัวเรื่องและเนื้อหา ส่วนลงนาม'},1)).toEqual(['หัวเรื่องและเนื้อหา ส่วนลงนาม']);
});
it('retains real multipage boundaries and removes only extra empty layout pages',()=>{
 expect(printedPageTexts({pageTexts:['หน้าแรก','\r\u0007','หน้าสอง'],mainText:'หน้าแรก หน้าสอง'},2)).toEqual(['หน้าแรก','หน้าสอง']);
});
it('rejects inconsistent multipage metadata instead of silently dropping printed content',()=>{
 expect(()=>printedPageTexts({pageTexts:['หน้าแรก','หน้าสอง','หน้าสาม'],mainText:'เนื้อหาทั้งหมด'},2)).toThrow('Word 3 หน้า / PDF 2 หน้า');
 expect(()=>printedPageTexts({pageTexts:[null]},1)).toThrow();
});
