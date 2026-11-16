import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const root=process.cwd(),folder=path.resolve('output/procurement-user-demo'),base='http://127.0.0.1:3110';
fs.mkdirSync(folder,{recursive:true});
const marker=path.join(folder,'SAFETY-TEST-ONLY'),signature='SARABUN_PROCUREMENT_USER_DEMO_V1';
if(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8').trim()!==signature)throw Error('Demo marker mismatch');
fs.writeFileSync(marker,signature+'\n');
try {const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)});if(response.ok){const state=JSON.parse(fs.readFileSync(path.join(folder,'server.json'),'utf8')),health=await response.json();if(health.pid!==state.pid)throw Error('Demo port belongs to another process');console.log('Demo already running: '+base);process.exit(0);}}catch(error){if(error.message==='Demo port belongs to another process')throw error;}
const manifest=JSON.parse(fs.readFileSync('.desktop/current.json','utf8')),app=path.join(root,'.desktop/versions',manifest.version,'app');
const stdout=fs.openSync(path.join(folder,'server.log'),'a'),stderr=fs.openSync(path.join(folder,'server-error.log'),'a');
const child=spawn(process.execPath,[path.join(app,'server.js')],{cwd:app,detached:true,windowsHide:true,stdio:['ignore',stdout,stderr],env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'3110',APP_URL:base,SARABUN_BUILD:'procurement-main-demo',SARABUN_SOURCE_DIR:folder,DATABASE_PATH:path.join(folder,'demo.sqlite'),DATABASE_REQUIRE_EXISTING:'false',SARABUN_REQUIRE_LOGIN:'false',SARABUN_DISABLE_AUTO_BACKUP:'true',SESSION_SECRET:randomBytes(48).toString('hex'),GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',SARABUN_DESKTOP_TOKEN:'',SARABUN_DESKTOP_INSTANCE:'procurement-user-demo'}});
await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();fs.closeSync(stdout);fs.closeSync(stderr);
fs.writeFileSync(path.join(folder,'server.json'),JSON.stringify({pid:child.pid,version:manifest.version,base,started:new Date().toISOString()},null,2));
for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));try{const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)});if(response.ok){const health=await response.json();if(health.pid!==child.pid)throw Error('Unexpected demo server');console.log('User demo ready: '+base+'/?view=procurement');process.exit(0);}}catch{}}
throw Error('Demo startup timed out; inspect output/procurement-user-demo/server-error.log');
