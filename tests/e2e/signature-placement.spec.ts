import {test,expect,type Page,type Locator} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import JSZip from "jszip";

// Chromium's cross-frame locator coordinates omit the parent's CSS transform.
// Use the rendered iframe scale for real mouse input in the zoomed preview.
async function previewBox(page:Page,locator:Locator){
 await locator.scrollIntoViewIfNeeded();
 let frame=await page.locator('iframe[title="ตัวอย่างหนังสือ A4"]').boundingBox();await expect.poll(async()=>{frame=await page.locator('iframe[title="ตัวอย่างหนังสือ A4"]').boundingBox();return frame!==null}).toBe(true);
 const box=await locator.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}),scale=frame!.width/794;
 return{x:frame!.x+box.x*scale,y:frame!.y+box.y*scale,width:box.width*scale,height:box.height*scale};
}
async function clickPreview(page:Page,locator:Locator){const box=await previewBox(page,locator);await page.mouse.click(box.x+box.width/2,box.y+box.height/2)}

test.skip(!process.env.SARABUN_E2E_DATA_ROOT,"Requires isolated release data");
test("place a signature on another page, resize at two zoom levels, save and export",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือ',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายนอก',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
 const title='ทดสอบลายเซ็น '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(title);
 await page.locator('#document-body').fill(('รายละเอียดประกอบการพิจารณาของเทศบาล เพื่อทดสอบการวางลายเซ็นบนหน้าถัดไป\n\n').repeat(20));
 await page.locator('.signature-editor > summary').click();
 await page.getByLabel('ไฟล์ภาพลายเซ็น',{exact:true}).setInputFiles('tests/fixtures/signature-synthetic.png');
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(page.getByText('คลิกจุดกึ่งกลางที่ต้องการวางลายเซ็นบนกระดาษ',{exact:true})).toBeVisible();
 await expect(preview.locator('body')).toHaveClass(/placing-overlay/);
 const target=preview.locator('.page').nth(1).locator('.signature');await clickPreview(page,target);
 const signature=preview.locator('.page').nth(1).getByLabel('ภาพลายเซ็น',{exact:true});
 await expect(signature).toBeVisible();await expect(page.locator('.signature-placement')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'ลายเซ็นที่ 1'}).getByRole('combobox',{name:'หน้า',exact:true})).toHaveValue('2');
 for(const zoom of ['65','100']){
  await page.getByLabel('ขนาดตัวอย่าง',{exact:true}).selectOption(zoom);
  await clickPreview(page,signature);
  const before=await signature.evaluate(el=>parseFloat((el as HTMLElement).style.width));
  const handle=signature.getByRole('button',{name:'ลากเพื่อปรับขนาดภาพ'});await expect(handle).toBeVisible();
  const box=await previewBox(page,handle);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+28,box.y+box.height/2+9,{steps:6});await page.mouse.up();
  await expect.poll(()=>signature.evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBeGreaterThan(before+4);
 }
 await signature.scrollIntoViewIfNeeded();const beforeMove=await signature.evaluate(el=>parseFloat((el as HTMLElement).style.left));
 const box=await previewBox(page,signature);await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x+38,box.y+23,{steps:5});await page.mouse.up();
 await expect.poll(()=>signature.evaluate(el=>parseFloat((el as HTMLElement).style.left))).toBeGreaterThan(beforeMove+4);
 await page.getByRole('region',{name:'ลายเซ็นที่ 1'}).getByRole('button',{name:'คลิกวางตำแหน่ง'}).click();
 await page.getByRole('button',{name:'ยกเลิกการวาง',exact:true}).click();await expect(preview.locator('body')).not.toHaveClass(/placing-overlay/);
 const geometry=await signature.evaluate(el=>{const style=(el as HTMLElement).style;return {x:style.left,y:style.top,width:style.width}});
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast[role=status]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 await page.getByRole('button',{name:'กลับรายการ',exact:true}).click();await page.getByRole('button',{name:'ทำต่อ: '+title,exact:true}).click();
 await expect(signature).toBeVisible();expect(await signature.evaluate(el=>{const s=(el as HTMLElement).style;return{x:s.left,y:s.top,width:s.width}})).toEqual(geometry);
 await page.getByLabel('ขนาดตัวอย่าง',{exact:true}).selectOption('65');await clickPreview(page,signature);await page.screenshot({path:'output/signature-placement.png'});
 const db=new DatabaseSync(path.join(process.env.SARABUN_E2E_DATA_ROOT!,'data/sarabun.sqlite'),{readOnly:true});
 const row=db.prepare("SELECT id,data FROM documents WHERE json_extract(data,'$.subject')=?").get(title) as {id:string;data:string};db.close();
 expect(JSON.parse(row.data).floatingItems[0].purpose).toBe('signature');
 const pdf=await page.request.get('/api/documents/'+row.id+'/pdf');expect(pdf.ok()).toBe(true);fs.writeFileSync('output/signature-export.pdf',await pdf.body());
 const word=await page.request.get('/api/documents/'+row.id+'/word');expect(word.ok()).toBe(true);const bytes=await word.body();fs.writeFileSync('output/signature-export.docx',bytes);
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('signature-synthetic.png');expect(xml).not.toContain('ลากเพื่อปรับขนาดภาพ');
});

test('signature controls fit a narrow internal-letter editor',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.goto('/');
 await page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'}).getByRole('button',{name:'หนังสือภายใน',exact:true}).click();
 await page.locator('.signature-editor > summary').click();await page.getByLabel('ไฟล์ภาพลายเซ็น',{exact:true}).setInputFiles('tests/fixtures/signature-synthetic.png');
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(preview.locator('body')).toHaveClass(/placing-overlay/);
 await clickPreview(page,preview.locator('.page').first().locator('.signature'));await expect(page.locator('.signature-placement')).toHaveCount(0);
 // Wait for the form to settle after scrolling back from the preview.
 const enlarge=page.getByRole('button',{name:'ขยายลายเซ็นที่ 1'});await enlarge.scrollIntoViewIfNeeded();
 let previousY:number|undefined,stable=0;await expect.poll(async()=>{const y=(await enlarge.boundingBox())?.y;stable=y!==undefined&&y===previousY?stable+1:0;previousY=y;return stable},{intervals:[100]}).toBeGreaterThanOrEqual(3);
 await enlarge.click();await expect(page.getByLabel('ขนาดลายเซ็นที่ 1')).toHaveValue('50');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'ลบลายเซ็นที่ 1'}).click();await expect(preview.getByLabel('ภาพลายเซ็น',{exact:true})).toHaveCount(0);
});


test('placing on a counterpart keeps a signature on both copies',async({page})=>{
 await page.goto('/');await page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'}).getByRole('button',{name:'หนังสือภายใน',exact:true}).click();
 await page.locator('.signature-editor > summary').click();await page.getByLabel('ไฟล์ภาพลายเซ็น',{exact:true}).setInputFiles('tests/fixtures/signature-synthetic.png');
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(preview.locator('body')).toHaveClass(/placing-overlay/);
 await page.getByRole('button',{name:'ยกเลิกการวาง',exact:true}).click();
 await page.getByText('ตราข้อความและรูปแบบตัวเลข',{exact:true}).click();
 await page.getByRole('combobox',{name:'ตราสำเนา',exact:true}).selectOption('สำเนาคู่ฉบับ');
 await expect(preview.getByLabel('ภาพลายเซ็น',{exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'คลิกวางตำแหน่ง',exact:true}).click();
 await expect(preview.locator('body')).toHaveClass(/placing-overlay/);
 await clickPreview(page,preview.locator('.counterpart-page .signature'));
 await expect(page.locator('.signature-placement')).toHaveCount(0);
 const original=preview.locator('.page:not(.counterpart-page)').getByLabel('ภาพลายเซ็น',{exact:true}),copy=preview.locator('.counterpart-page').getByLabel('ภาพลายเซ็น',{exact:true});
 await expect(original).toHaveCount(1);await expect(copy).toHaveCount(1);
 await expect.poll(async()=>copy.evaluate(el=>(el as HTMLElement).style.top)).toBe(await original.evaluate(el=>(el as HTMLElement).style.top));
});
