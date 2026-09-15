import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
test('PDF preview paints page pixels without a browser PDF plugin',async({page})=>{
 const pdf=await PDFDocument.create();for(let n=1;n<=4;n++)pdf.addPage([400,500]).drawText(`PDF preview page ${n}`,{x:30,y:400,size:24});
 const bytes=process.env.PDF_PREVIEW_SOURCE_ID?await (await page.request.get(`/api/attachments/${process.env.PDF_PREVIEW_SOURCE_ID}`)).body():Buffer.from(await pdf.save());await page.route('**/api/attachments/*',route=>route.fulfill({contentType:'application/pdf',body:bytes}));
 await page.goto('/');await page.getByRole('button',{name:/ข้อมูลสาธิต — บันทึกพร้อมเอกสารแนบ/}).first().click();
 const preview=page.locator('.attachment-preview');await preview.scrollIntoViewIfNeeded();
 await expect(preview.locator('.pdf-render-page')).toHaveCount(4);
 for(let i=0;i<4;i++){const canvas=preview.locator('canvas').nth(i);await preview.locator('.pdf-render-page').nth(i).scrollIntoViewIfNeeded();await expect(canvas).toHaveAttribute('data-rendered','true');const colored=await canvas.evaluate(c=>{const canvas=c as HTMLCanvasElement;const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let ink=0,white=0;for(let j=0;j<data.length;j+=4){if(data[j]<100&&data[j+3]>0)ink++;if(data[j]>240)white++;}return ink>100&&white>1000;});expect(colored).toBe(true);}
 await preview.locator('canvas').first().scrollIntoViewIfNeeded();await page.screenshot({path:'output/pdf-preview-fixed.png'});
});
