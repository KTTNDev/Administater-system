import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn,type ChildProcess} from 'node:child_process';import {randomBytes} from 'node:crypto';
test.describe('isolated production login',()=>{
 test.skip(process.env.RUN_PRODUCTION_SMOKE!=='1','Requires a completed production build; opt in explicitly');
 let server:ChildProcess;const url='http://127.0.0.1:3109',password=randomBytes(20).toString('hex');
 test.beforeAll(async()=>{
  const workspace=process.cwd(),manifest=JSON.parse(fs.readFileSync(path.join(workspace,'.desktop/current.json'),'utf8'));
  const runtime=path.join(workspace,'.desktop/versions',manifest.version,'app');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-login-smoke-'));
  server=spawn(process.execPath,[path.join(runtime,'server.js')],{cwd:runtime,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',PORT:'3109',HOSTNAME:'127.0.0.1',SARABUN_DESKTOP_TOKEN:'',SARABUN_REQUIRE_LOGIN:'true',LOCAL_DEMO:'true',APP_URL:url,APP_PASSWORD:password,SESSION_SECRET:randomBytes(32).toString('hex'),DATABASE_PATH:path.join(folder,'data.sqlite'),SARABUN_SOURCE_DIR:folder,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''}});
  for(let n=0;n<40;n++){if(server.exitCode!==null)throw new Error('Isolated server failed to start');try{const response=await fetch(url+'/api/health');if(response.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
  throw new Error('Isolated server timeout');
 });
 test.afterAll(()=>server?.kill());
 test('requires login even when LOCAL_DEMO is set, rejects wrong password, accepts valid session',async({page})=>{
  await page.goto(url);await expect(page).toHaveURL(url+'/login');
  await page.getByLabel('รหัสผ่านผู้ปฏิบัติงาน').fill('wrong-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();await page.getByLabel('รหัสผ่านผู้ปฏิบัติงาน').fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.getByRole('heading',{name:'พื้นที่ทำงาน'})).toBeVisible();
 });
});
