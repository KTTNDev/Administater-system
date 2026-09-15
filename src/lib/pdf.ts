import "server-only";
import { chromium } from "playwright";
import fs from "node:fs";
import type { Draft } from "./document";
import { documentHtml } from "./render-document";
import { documentAssets } from "./assets";
import { appendAttachments } from "./attachments";
export async function renderPdf(draft: Draft) {
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
  const browser=await chromium.launch({headless:true,executablePath});
  try {
    const page=await browser.newPage(); await page.route("**/*",route=>route.abort());
    await page.setContent(documentHtml(draft,documentAssets()),{waitUntil:"load"});
    await page.waitForFunction(()=> (window as unknown as {__paginationDone:boolean}).__paginationDone, undefined, {timeout:15000});
    if(await page.evaluate(()=> (window as unknown as {__overflow:boolean}).__overflow)) throw new Error("มีส่วนของหนังสือยาวเกินหน้ากระดาษ กรุณาแบ่งข้อความก่อนส่งออก");
    const cover=await page.pdf({format:"A4",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
    return await appendAttachments(cover,draft);
  } finally { await browser.close(); }
}
