import {it,expect} from 'vitest';
import {searchWorkActions} from '../src/lib/action-search';
it('ranks Thai work requests and English synonyms',()=>{
 for(const [query,id] of [['อยากโอนงบซื้อคอม','budget'],['จองห้องประชุมพรุ่งนี้','bookings'],['นัดประชุมพร้อมแนบหนังสือ','calendar'],['อยากทำบันทึกข้อความ','create-internal'],['ช่วยกู้คืนข้อมูล','backup'],['upload ไม่ได้ อยาก sync Drive','drive']])expect(searchWorkActions(query)[0]?.action.id,query).toBe(id);
});
it('returns related choices, empty state and bounded defaults',()=>{
 expect(searchWorkActions('ประชุม').length).toBeGreaterThan(1);
 expect(searchWorkActions('ซื้อพิซซ่า')).toEqual([]);
 expect(searchWorkActions('   ')).toHaveLength(6);
 expect(searchWorkActions('DRIVE')[0].action.id).toBe('drive');
});
