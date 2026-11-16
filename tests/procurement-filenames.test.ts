import {it,expect} from 'vitest';
import {newProcurement} from '../src/lib/procurement';
import {procurementFilename,procurementBundleName,filenamePart,procurementDownloadHeader} from '../src/lib/procurement-filenames';
it('uses the bill total and readable subject for Word, PDF and ZIP, with Windows-safe lengths',()=>{
 const data={...newProcurement('purchase'),title:'ซื้อกระดาษ'};data.common.agreed='1366.00';
 const name=procurementFilename(data,'รายงานขอซื้อ / วัสดุ:สำนักงาน',2,'docx');
 expect(name).toBe('1,366.00บาท_รายงานขอซื้อ วัสดุ สำนักงาน_ฉบับ2.docx');
 expect(procurementBundleName(data,'zip')).toBe('1,366.00บาท_ชุดเอกสารจัดซื้อ_ซื้อกระดาษ.zip');
 expect(procurementBundleName(data,'pdf',2)).toContain('ชุดส่งคลังรอบ2');
 expect(procurementFilename(data,'😀'.repeat(200),22,'docx').length).toBeLessThan(200);
 expect(filenamePart('../โฟลเดอร์\\ไฟล์\nใหม่:*?')).not.toMatch(/[\\/\n:*?]/);
 expect(procurementDownloadHeader(name)).toContain("filename*=UTF-8''1%2C366.00");
});
