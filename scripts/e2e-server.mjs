import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const source=process.cwd(),root=path.resolve(process.env.SARABUN_E2E_DATA_ROOT||'');
if(!root.startsWith(path.join(source,'output','e2e')+path.sep)||!root.endsWith(path.join('output','feature-check')))throw Error('E2E requires an isolated feature-check directory');
fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'SAFETY-TEST-ONLY'),'Disposable Phase 4 end-to-end test data');
for(const folder of ['budget-references','template-references'])if(fs.existsSync(path.join(source,'data',folder)))fs.cpSync(path.join(source,'data',folder),path.join(root,'data',folder),{recursive:true});
for(const folder of ['fonts','assets'])if(fs.existsSync(path.join(source,'public',folder)))fs.cpSync(path.join(source,'public',folder),path.join(root,'public',folder),{recursive:true});
fs.cpSync(path.join(source,'scripts'),path.join(root,'scripts'),{recursive:true});
if(fs.existsSync(path.join(source,'.desktop/current.json'))){fs.mkdirSync(path.join(root,'.desktop'),{recursive:true});fs.copyFileSync(path.join(source,'.desktop/current.json'),path.join(root,'.desktop/current.json'));}
const env={...process.env,SARABUN_SOURCE_DIR:root,DATABASE_PATH:path.join(root,'data','sarabun.sqlite'),DATABASE_REQUIRE_EXISTING:'false',SARABUN_REQUIRE_LOGIN:'false',SARABUN_PROCUREMENT_LAB:'false',SARABUN_BUILD:'',SARABUN_DESKTOP_TOKEN:'',SARABUN_DESKTOP_INSTANCE:'phase4-e2e',LOCAL_DEMO:'false',SESSION_SECRET:randomBytes(40).toString('hex'),APP_PASSWORD:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',DRIVE_ROOT_FOLDER_ID:'',SARABUN_DISABLE_AUTO_BACKUP:'true',APP_URL:'http://127.0.0.1:3100',PROCUREMENT_PDF_CONCURRENCY:'1'};
fs.writeFileSync(path.join(root,'.env.local'),`SESSION_SECRET=${env.SESSION_SECRET}\nDATABASE_PATH=${env.DATABASE_PATH.replaceAll('\\','/')}\nAPP_URL=${env.APP_URL}\n`);
const mode=fs.existsSync('.next-workspace/BUILD_ID')?'start':'dev';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,...(mode==='dev'?['--webpack']:[]),'--hostname','127.0.0.1','--port','3100'],{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
