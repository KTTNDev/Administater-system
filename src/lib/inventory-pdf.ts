import 'server-only';
import {chromium} from 'playwright';
import fs from 'node:fs';
export async function inventoryPdf(html:string){
 const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({headless:true,executablePath});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  if(await page.locator('#pages').count()){
   await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone?:boolean}).__paginationDone));
   if(await page.evaluate(()=>Boolean((window as unknown as {__overflow?:boolean}).__overflow)))throw Error('บางรายการสูงเกินหน้ากระดาษ กรุณาย่อข้อความในแถวรายการก่อนส่งออก');
  }
  return new Uint8Array(await page.pdf({preferCSSPageSize:true,printBackground:true}));
 }finally{await browser.close();}
}
