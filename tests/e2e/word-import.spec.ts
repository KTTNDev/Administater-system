import {test,expect} from '@playwright/test';
import JSZip from 'jszip';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {buildDossierSyncPlan} from '../../scripts/dossier-sync-plan.mjs';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Isolated installation only');
async function word(){const z=new JSZip(),p=(s:string)=>'<w:p><w:r><w:t>'+s+'</w:t></w:r></w:p>';z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+['บันทึกข้อความ','ส่วนราชการ กองสวัสดิการสังคม','ที่ ทส ทดสอบ/๑ วันที่ ๖ พฤศจิกายน ๒๕๖๙','เรื่อง ทดสอบนำเข้า Word','เรียน นายกเทศมนตรี','ข้อเท็จจริง','ด้วยกองสวัสดิการสังคมมีความประสงค์จัดโครงการ','จึงเรียนมาเพื่อโปรดพิจารณา','(นายสมชาย ตัวอย่าง)','ผู้อำนวยการกองสวัสดิการสังคม'].map(p).join('')+'</w:body></w:document>');return z.generateAsync({type:'nodebuffer'});}
test('reviews before importing, edits and exports the draft and downloads the exact original',async({page,request})=>{
 test.setTimeout(120000);const root=process.env.SARABUN_E2E_DATA_ROOT!;expect(fs.existsSync(path.join(root,'SAFETY-TEST-ONLY'))).toBe(true);const bytes=await word();
 await page.goto('/?view=templates');await page.getByRole('button',{name:'นำเข้า Word',exact:true}).click();const dialog=page.getByRole('dialog',{name:'นำเข้า Word เป็นร่างหนังสือ'});
 await dialog.getByLabel('ไฟล์ Word ที่ต้องการนำเข้า').setInputFiles({name:'ต้นฉบับ.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:bytes});await expect(dialog.getByLabel('เรื่อง *',{exact:true})).toHaveValue('ทดสอบนำเข้า Word');await expect(dialog.getByLabel('วันที่หนังสือ',{exact:true})).toHaveValue('2026-11-06');
 await expect(dialog.getByRole('button',{name:'สร้างร่างและเปิดแก้ไข'})).toBeDisabled();const title='นำเข้า Word ตรวจใช้งาน '+Date.now();await dialog.getByLabel('เรื่อง *',{exact:true}).fill(title);
 const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));try{expect(db.prepare("SELECT count(*) n FROM document_sources").get()!.n).toBe(0);
 await page.screenshot({path:'output/word-import-review.png'});await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'สร้างร่างและเปิดแก้ไข'}).click();await expect(dialog).not.toBeVisible();await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(title);
 const row=db.prepare('SELECT id,document_id FROM document_sources').get()!;const draft=JSON.parse(String(db.prepare('SELECT data FROM documents WHERE id=?').get(row.document_id)!.data));expect(draft.status).toBe('draft');expect(draft.numeralStyle).toBe('thai');
 const original=await request.get('/api/document-sources/'+row.id);expect(original.status()).toBe(200);expect((await original.body()).equals(bytes)).toBe(true);
 const plan=buildDossierSyncPlan(db,path.join(root,'output/storage'));expect(plan.entries.some(e=>e.ownerId===row.document_id&&e.relativePath.includes('ต้นฉบับนำเข้า')&&e.mime.includes('wordprocessingml'))).toBe(true);
 await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('body')).toContainText('ด้วยกองสวัสดิการสังคม');
 await page.locator('#document-body').fill(draft.body+'\nข้อความที่แก้ต่อหลังนำเข้า');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const exported=await request.get('/api/documents/'+row.document_id+'/word');expect(exported.status()).toBe(200);const zip=await JSZip.loadAsync(await exported.body());expect(await zip.file('word/document.xml')!.async('string')).toContain('ข้อความที่แก้ต่อหลังนำเข้า');await page.screenshot({path:'output/word-import-editor.png'});
 }finally{db.close();}
});
test('rejects corrupt Word and allows cancellation without creating any document',async({page})=>{
 await page.goto('/?view=templates');await page.getByRole('button',{name:'นำเข้า Word',exact:true}).click();const dialog=page.getByRole('dialog',{name:'นำเข้า Word เป็นร่างหนังสือ'});await dialog.getByLabel('ไฟล์ Word ที่ต้องการนำเข้า').setInputFiles({name:'bad.docx',mimeType:'application/octet-stream',buffer:Buffer.from('broken')});await expect(dialog.getByRole('alert')).toContainText('เปิดไฟล์ Word ไม่ได้');await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(dialog).not.toBeVisible();
});
