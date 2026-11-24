import {afterEach,describe,expect,it,vi} from 'vitest';
import {CONNECTION_MESSAGE,procurementFetch,procurementJson} from '../src/lib/procurement/storage/client-request';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('procurement transport recovery',()=>{
 it('explains a disconnected server and does not replay a write',async()=>{
   const fetcher=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetcher);
   await expect(procurementJson('/save',{method:'POST',body:'one write'})).rejects.toThrow(CONNECTION_MESSAGE);
   expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('preserves actionable conflict errors from the server',async()=>{
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'ข้อมูลถูกแก้ไขจากหน้าต่างอื่น'},{status:409})));
   await expect(procurementJson('/save')).rejects.toThrow('ข้อมูลถูกแก้ไขจากหน้าต่างอื่น');
 });
 it('turns an HTML server response into a useful recovery message',async()=>{
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>offline</html>',{status:503})));
   await expect(procurementJson('/save')).rejects.toThrow('ระบบส่งข้อมูลกลับมาไม่ถูกต้อง (503)');
 });
 it('explains an expired session without advising the user to discard the form',async()=>{
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('login',{status:401})));
   await expect(procurementJson('/save')).rejects.toThrow('เก็บหน้านี้ไว้ก่อน');
 });
 it('bounds a stalled request and warns against blindly repeating a save',async()=>{
   vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));
   const request=expect(procurementFetch('/save',{method:'POST'},1000)).rejects.toThrow('ตรวจข้อมูลล่าสุดก่อนส่งซ้ำ');
   await vi.advanceTimersByTimeAsync(1000);await request;
 });
 it('keeps caller cancellation distinct from a connection failure',async()=>{
   const external=new AbortController();vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));
   const request=expect(procurementFetch('/preview',{signal:external.signal})).rejects.toMatchObject({name:'AbortError'});
   external.abort();await request;
 });
 it('returns successful payloads and server validation details',async()=>{
   vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({version:2})).mockResolvedValueOnce(Response.json({issues:[{messageTh:'กรอกวันที่ก่อน'}]},{status:400})));
   await expect(procurementJson('/save')).resolves.toEqual({version:2});
   await expect(procurementJson('/save')).rejects.toThrow('กรอกวันที่ก่อน');
 });
});
