import 'server-only';
import fs from 'node:fs';
import {chromium, type Browser, type Page} from 'playwright';

const state = {browser: undefined as Browser | undefined, launch: undefined as Promise<Browser> | undefined, active: 0, queue: [] as (() => void)[], timer: undefined as NodeJS.Timeout | undefined, shutdown: false};
const maxConcurrency = () => Math.max(1, Math.min(3, Number(process.env.PROCUREMENT_PDF_CONCURRENCY) || 3));
async function browserInstance() {
  if (state.shutdown) throw new Error('ระบบกำลังปิดตัว ไม่สามารถเริ่มงานส่งออกใหม่ได้');
  if (state.browser?.isConnected()) return state.browser;
  if (!state.launch) {
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
    state.launch = chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})}).then(browser => {
      state.browser = browser;
      browser.on('disconnected', () => {if (state.browser === browser) state.browser = undefined;});
      return browser;
    }).finally(() => {state.launch = undefined;});
  }
  return state.launch;
}
export async function closeProcurementBrowser() {
  clearTimeout(state.timer);
  const browser = state.browser ?? await state.launch;
  state.browser = undefined;
  await browser?.close();
}
export async function withProcurementPage<T>(job: (page: Page) => Promise<T>): Promise<T> {
  if (state.active >= maxConcurrency() || state.queue.length) await new Promise<void>(resolve => state.queue.push(resolve));
  else state.active++;
  clearTimeout(state.timer);
  let context;
  try {
    context = await (await browserInstance()).newContext({viewport: {width: 794, height: 1123}, deviceScaleFactor: 1, serviceWorkers: 'block'});
    const page = await context.newPage();
    // Everything printable must be embedded. No renderer job may make network/file requests.
    await page.route('**/*', route => route.abort());
    page.setDefaultTimeout(30000);
    return await job(page);
  } finally {
    try {await context?.close();} finally {
      const next = state.queue.shift();
      if (next) next(); // transfer the occupied slot directly to the next waiter
      else state.active--;
      if (!state.active) {
        state.timer = setTimeout(() => {void closeProcurementBrowser();}, 120000);
        state.timer.unref();
      }
    }
  }
}
const cleanup = () => {state.shutdown = true; void closeProcurementBrowser().catch(() => {});};
process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);
