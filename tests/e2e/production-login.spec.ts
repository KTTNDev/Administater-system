import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn,type ChildProcess} from 'node:child_process';import {randomBytes} from 'node:crypto';
test.describe('isolated production login',()=>{
 test.skip(process.env.RUN_PRODUCTION_SMOKE!=='1','Requires a completed production build; opt in explicitly');
 let server:ChildProcess;const url='http://127.0.0.1:3109',password=randomBytes(20).toString('hex');
 test.beforeAll(async()=>{
  const workspace=process.cwd(),config=path.join(workspace,'.runtime-local.json'),runtime=fs.existsSync(config)?JSON.parse(fs.readFileSync(config,'utf8')).path:workspace;
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-login-smoke-'));
  server=spawn(process.execPath,[path.join(runtime,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3109'],{cwd:runtime,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',LOCAL_DEMO:'true',APP_URL:url,APP_PASSWORD:password,SESSION_SECRET:randomBytes(32).toString('hex'),DATABASE_PATH:path.join(folder,'data.sqlite'),SARABUN_SOURCE_DIR:workspace,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''}});
  for(let n=0;n<40;n++){if(server.exitCode!==null)throw new Error('Isolated server failed to start');try{const response=await fetch(url+'/api/health');if(response.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
  throw new Error('Isolated server timeout');
 });
 test.afterAll(()=>server?.kill());
 test('requires login even when LOCAL_DEMO is set, rejects wrong password, accepts valid session',async({page})=>{
  await page.goto(url);await expect(page).toHaveURL(url+'/login');
  await page.getByLabel('รหัสผ่านผู้ปฏิบัติงาน').fill('wrong-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();await page.getByLabel('รหัสผ่านผู้ปฏิบัติงาน').fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page.getByRole('heading',{name:'ค้นหา จัดการ และสร้างหนังสือ'})).toBeVisible();
 });
});
