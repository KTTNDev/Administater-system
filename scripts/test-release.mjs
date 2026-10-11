import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

// Fresh, disposable installation for every run. Never load workspace credentials.
const source=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
if(process.argv[2]==='serve'){
 const runtime=process.env.SARABUN_TEST_RUNTIME;
 if(!runtime||!fs.existsSync(path.join(process.env.SARABUN_SOURCE_DIR,'SAFETY-TEST-ONLY')))throw Error('Missing isolated fixture');
 await import(pathToFileURL(path.join(runtime,'server.js')).href);
}else{
 const version=JSON.parse(fs.readFileSync(path.join(source,'.desktop/current.json'),'utf8')).version;
 const runtime=path.join(source,'.desktop/versions',version,'app');
 const root=path.join(source,'output','v1-tests',Date.now().toString(),'output','feature-check');
 fs.mkdirSync(path.join(root,'data'),{recursive:true});
 fs.writeFileSync(path.join(root,'SAFETY-TEST-ONLY'),'Disposable release test data');
 for(const folder of ['budget-references','template-references'])if(fs.existsSync(path.join(source,'data',folder)))fs.cpSync(path.join(source,'data',folder),path.join(root,'data',folder),{recursive:true});
 fs.cpSync(path.join(source,'scripts'),path.join(root,'scripts'),{recursive:true});
 fs.mkdirSync(path.join(root,'.desktop'),{recursive:true});fs.copyFileSync(path.join(source,'.desktop/current.json'),path.join(root,'.desktop/current.json'));
 const env={...process.env,NODE_ENV:'production',PORT:'3100',HOSTNAME:'127.0.0.1',APP_URL:'http://127.0.0.1:3100',SARABUN_SOURCE_DIR:root,SARABUN_TEST_RUNTIME:runtime,DATABASE_PATH:path.join(root,'data/sarabun.sqlite'),SARABUN_REQUIRE_LOGIN:'false',SARABUN_DESKTOP_TOKEN:'',SARABUN_DESKTOP_INSTANCE:'v1-isolated',LOCAL_DEMO:'false',SESSION_SECRET:randomBytes(40).toString('hex'),APP_PASSWORD:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',CHROMIUM_EXECUTABLE_PATH:process.env.CHROMIUM_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'};
 fs.writeFileSync(path.join(root,'.env.local'),`SESSION_SECRET=${env.SESSION_SECRET}\nDATABASE_PATH=${env.DATABASE_PATH.replaceAll('\\','/')}\nAPP_URL=${env.APP_URL}\n`);
 const log=fs.openSync(path.join(root,'server.log'),'a');
 let server;
 try{
  try{await fetch(env.APP_URL+'/api/health',{signal:AbortSignal.timeout(1000)});throw Error('Test port 3100 is occupied');}catch(e){if(e.cause?.code!=='ECONNREFUSED')throw e;}
  server=spawn(process.execPath,[fileURLToPath(import.meta.url),'serve'],{cwd:root,windowsHide:true,env,stdio:['ignore',log,log]});
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error('Test server exited');try{const r=await fetch(env.APP_URL+'/api/health');if(r.ok){ready=true;break;}}catch{}await delay(500);}
  if(!ready)throw Error('Test server timeout');
  await fetch(env.APP_URL);
  console.log('Disposable fixture: '+root);
  const args=process.argv.slice(2);
  const child=spawn(process.execPath,[path.join(source,'node_modules/@playwright/test/cli.js'),'test',...args],{cwd:source,windowsHide:true,stdio:'inherit',env:{...env,PLAYWRIGHT_BASE_URL:env.APP_URL,SARABUN_E2E_DATA_ROOT:root,SARABUN_SAFETY_TEST_ROOT:root,RUN_PRODUCTION_SMOKE:'1',SARABUN_TEST_DESKTOP_ROOT:''}});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 }finally{if(server&&server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}fs.closeSync(log);}
}
