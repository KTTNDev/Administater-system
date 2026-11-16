import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
// The real Workspace and real procurement APIs, isolated from the user's database.
const root=path.resolve('output/procurement-main-demo');fs.mkdirSync(root,{recursive:true});
const marker=path.join(root,'SAFETY-TEST-ONLY');
if(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8').trim()!=='SARABUN_PROCUREMENT_MAIN_DEMO_V1')throw Error('Safety marker mismatch');
fs.writeFileSync(marker,'SARABUN_PROCUREMENT_MAIN_DEMO_V1\n');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3108'],{stdio:'inherit',windowsHide:true,env:{...process.env,SARABUN_BUILD:'procurement-main-demo',SARABUN_PROCUREMENT_LAB:'false',SARABUN_REQUIRE_LOGIN:'false',DATABASE_PATH:path.join(root,'main-demo.sqlite'),DATABASE_REQUIRE_EXISTING:'false',SARABUN_SOURCE_DIR:root,SESSION_SECRET:randomBytes(32).toString('hex'),GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',SARABUN_DISABLE_AUTO_BACKUP:'true'}});
child.on('exit',code=>{process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
