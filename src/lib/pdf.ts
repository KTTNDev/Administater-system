import {MissingOverlayPageError} from "./export-validation";
import "server-only";
import { chromium, type Browser } from "playwright";
import fs from "node:fs";
import type { Draft } from "./document";
import { documentHtml } from "./render-document";
import { documentAssets } from "./assets";
import { appendAttachments } from "./attachments";
import { appendixSources, validateAppendixImages } from "./appendix";
import {PDFDocument} from 'pdf-lib';
import {normalizeThaiCMaps} from './procurement/exporters/pdf/thai-cmap';
async function renderDraftWithBrowser(browser: Browser, draft: Draft) {
  validateAppendixImages(draft);
  const sources=appendixSources(draft);
  const page=await browser.newPage();
  try {
    await page.route("**/*",route=>route.abort());
    await page.setContent(documentHtml(draft,documentAssets(),sources),{waitUntil:"load"});
    await page.waitForFunction(()=> (window as unknown as {__paginationDone:boolean}).__paginationDone, undefined, {timeout:15000});
    const missing=await page.evaluate(()=> (window as unknown as {__missingOverlayPages:number[]}).__missingOverlayPages);
    if(missing.length)throw new MissingOverlayPageError(missing);
    if(await page.evaluate(()=> (window as unknown as {__overflow:boolean}).__overflow)) throw new Error("มีส่วนของหนังสือยาวเกินหน้ากระดาษ กรุณาแบ่งข้อความก่อนส่งออก");
    let cover=await page.pdf({format:"A4",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
    if(draft.procurementSource||draft.layout.startsWith('procurement-')){
      const pdf=await PDFDocument.load(cover);normalizeThaiCMaps(pdf);cover=Buffer.from(await pdf.save());
    }
    const originalPages=await page.locator('.page:not(.counterpart-page)').count();
    return await appendAttachments(cover,draft,originalPages);
  } finally { await page.close(); }
}
export async function withPdfRenderer<T>(work: (render: (draft: Draft) => Promise<Buffer>) => Promise<T>): Promise<T> {
  const state: { browser: Browser | null } = { browser: null };
  const render = async (draft: Draft) => {
    if (!state.browser) {
      const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
      state.browser=await chromium.launch({headless:true,executablePath});
    }
    return renderDraftWithBrowser(state.browser, draft);
  };
  try { return await work(render); }
  finally { if (state.browser) await state.browser.close(); }
}
export async function renderPdf(draft: Draft) {
  return withPdfRenderer(render => render(draft));
}
