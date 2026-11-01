// Read-only UI checks on the running desktop app. Does not save drafts or create records.
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'output','craft-ui');await fs.mkdir(output,{recursive:true});
const base=process.env.UI_TEST_URL||'http://localhost:3000';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={views:[],documents:[],video:{},errors:[]};
const views={home:'home',dashboard:'documents',templates:'documents',register:'documents',tasks:'tasks',office:'tasks',projects:'projects',inventory:'inventory',reports:'reports',budget:'reports',calendar:'calendar',bookings:'calendar',laws:'reference',guide:'reference',settings:'reference'};
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.setDefaultTimeout(20000);
 for(const [view,category] of Object.entries(views)) {
  await page.goto(base+(view==='home'?'/home':'/?view='+view),{waitUntil:'networkidle'});
  // Guide is an in-workspace tab; it is not accepted as an initial query view.
  if(view==='guide')await page.getByRole('button',{name:'คู่มือและแหล่งอ้างอิง',exact:true}).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-workspace-category',category);
  await page.screenshot({path:path.join(output,`${view}-1440.png`)});
  for(const width of [1440,768,414,375,320]) {
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(70);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   report.views.push({view,...size});
   expect(size.scroll,view+' horizontal overflow at '+width).toBeLessThanOrEqual(width+1);
   if(view==='home'||view==='projects')await page.screenshot({path:path.join(output,`${view}-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto(base+'/home',{waitUntil:'networkidle'});
 const video=page.locator('.home-hero-media video');
 await expect.poll(()=>video.evaluate(el=>!el.paused&&el.currentTime>0)).toBe(true);
 await page.getByRole('button',{name:'หยุดภาพพื้นหลัง',exact:true}).click();
 await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
 const stopped=await video.evaluate(el=>el.currentTime);await page.waitForTimeout(300);
 expect(await video.evaluate(el=>el.currentTime)).toBe(stopped);
 await page.getByRole('button',{name:'เล่นภาพพื้นหลัง',exact:true}).click();
 await expect.poll(()=>video.evaluate(el=>!el.paused)).toBe(true);
 // Observe a real loop rather than relying only on the loop attribute.
 await expect.poll(()=>video.evaluate(el=>Number.isFinite(el.duration)),{timeout:20000}).toBe(true);
 const duration=await video.evaluate(el=>el.duration);
 await video.evaluate(el=>{el.currentTime=el.duration-.35;});await page.waitForTimeout(900);
 expect(await video.evaluate(el=>el.currentTime)).toBeLessThan(2);
 report.video={duration,loop:true,pause:true,muted:await video.evaluate(el=>el.muted)};
 await page.getByRole('button',{name:'ย่อแถบเมนู',exact:true}).click();
 await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
 await expect(page.locator('.sidebar .nav-label').first()).not.toBeVisible();
 await page.screenshot({path:path.join(output,'home-collapsed.png')});
 await page.getByRole('button',{name:'ขยายแถบเมนู',exact:true}).click();
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});
 await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
 report.video.reducedMotion=true;
 // Same blank external draft used for the pre-change HTML baseline.
 await page.goto(base+'/?view=templates',{waitUntil:'networkidle'});
 await page.locator('.template-feature').first().click();
 const iframe=page.locator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(iframe).toBeVisible();await page.waitForTimeout(900);
 const html=await iframe.getAttribute('srcdoc');
 await fs.writeFile(path.join(output,'after-document.html'),html||'');
 try {const before=await fs.readFile(path.join(output,'before-document.html'),'utf8');report.documentHtmlUnchanged=before===html;expect(html,'Document HTML unchanged').toBe(before);}catch(error){if(error.code!=='ENOENT')throw error;}
 await page.screenshot({path:path.join(output,'editor-1440.png')});
 await page.goto(base+'/?view=templates',{waitUntil:'networkidle'});
 const count=await page.locator('.template-card').count();
 for(let index=0;index<count;index++) {
  if(index)await page.goto(base+'/?view=templates',{waitUntil:'networkidle'});
  const card=page.locator('.template-card').nth(index),name=await card.locator('h3').textContent();
  await card.click();
  const paper=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first();
  await expect(paper).toBeVisible();await expect(paper).toHaveCSS('background-color','rgb(255, 255, 255)');
  const data=await paper.evaluate(el=>({color:getComputedStyle(el).color,width:el.getBoundingClientRect().width,background:getComputedStyle(el).backgroundColor}));
  report.documents.push({name,...data});
 }
 expect(report.errors).toEqual([]);
 console.log(JSON.stringify({viewChecks:report.views.length,forms:report.documents.length,video:report.video,documentHtmlUnchanged:report.documentHtmlUnchanged,errors:report.errors},null,2));
} finally {
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));
 await browser.close();
}
