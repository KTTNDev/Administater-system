import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,type ChildProcess} from 'node:child_process';

test.describe('direct single-user access',()=>{
 test.skip(process.env.RUN_PRODUCTION_SMOKE!=='1','Requires a desktop build');
 let server:ChildProcess;const url='http://127.0.0.1:3110';
 test.beforeAll(async()=>{
  const workspace=process.cwd(),manifest=JSON.parse(fs.readFileSync(path.join(workspace,'.desktop/current.json'),'utf8'));
  const runtime=path.join(workspace,'.desktop/versions',manifest.version,'app');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-no-login-'));
  server=spawn(process.execPath,[path.join(runtime,'server.js')],{cwd:runtime,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',PORT:'3110',HOSTNAME:'127.0.0.1',SARABUN_REQUIRE_LOGIN:'false',SARABUN_DESKTOP_TOKEN:'',LOCAL_DEMO:'false',APP_URL:url,APP_PASSWORD:'',SESSION_SECRET:'',DATABASE_PATH:path.join(folder,'data.sqlite'),SARABUN_SOURCE_DIR:workspace,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''}});
  for(let n=0;n<40;n++){if(server.exitCode!==null)throw new Error('Isolated server failed');try{if((await fetch(url+'/api/health')).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  throw new Error('Isolated server timeout');
 });
 test.afterAll(()=>server?.kill());
 test('opens old login links and saves drafts after cookies are cleared',async({page,context})=>{
  await context.addCookies([{name:'sarabun-session',value:'expired-session',url}]);
  await page.goto(url+'/login');
  await expect(page.getByRole('heading',{name:'พื้นที่ทำงาน'})).toBeVisible();
  await expect(page.getByRole('button',{name:'ออกจากระบบ',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('รหัสผ่านผู้ปฏิบัติงาน')).toHaveCount(0);
  await context.clearCookies();await page.reload();
  await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายนอก",exact:true})}).click();
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();
  await page.getByLabel('เรื่อง / ชื่อร่าง').fill('ทดสอบเข้าใช้โดยไม่ล็อกอิน');
  await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();
  await expect(page.getByText('บันทึกแล้ว',{exact:true})).toBeVisible();
  await context.clearCookies();await page.goto(url);
  await expect(page.getByText('ทดสอบเข้าใช้โดยไม่ล็อกอิน',{exact:true}).first()).toBeVisible();
  await page.goto(url+'/desktop#token=expired');
  await expect(page.getByRole('heading',{name:'พื้นที่ทำงาน'})).toBeVisible();
  expect((await page.request.get(url+'/api/attachments/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
  await page.goto(url+'/?view=settings');
  await expect(page.getByRole('region',{name:'ความพร้อมใช้งานจริง'})).toContainText('เปิดใช้งานได้ทันที ไม่ต้องล็อกอิน');
 });
});
