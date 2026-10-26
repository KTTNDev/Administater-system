// Opens this checkout. Never redirects to another machine's runtime or source folder.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import config from '../next.config.mjs';
const workspace=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
process.chdir(workspace);
let origin='http://127.0.0.1:3000';
const workspaceId=createHash('sha256').update(workspace.toLowerCase()).digest('hex').slice(0,16);
async function identity(url=origin){try{return await (await fetch(url+'/api/health',{signal:AbortSignal.timeout(1500)})).json();}catch{return null;}}
function openBrowser(){spawn('explorer.exe',[origin],{detached:true,stdio:'ignore',windowsHide:true}).unref();}
async function main(){
 const ports=[3000,3001,3002,3003,3004];
 for(const port of ports){const url='http://127.0.0.1:'+port;const running=await identity(url);if(running?.workspaceId===workspaceId){origin=url;openBrowser();console.log('Ready: '+origin);return;}}
 let selected;
 for(const port of ports){const free=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});if(free){selected=port;break;}}
 if(!selected)throw new Error('Ports 3000-3004 are occupied. Close another local server and retry.');
 origin='http://127.0.0.1:'+selected;
 const env={...process.env,SARABUN_SOURCE_DIR:workspace,SARABUN_LOCAL_DESKTOP:'true',SARABUN_PORT:String(selected),APP_URL:origin};
 if(!fs.existsSync(path.join(workspace,config.distDir,'BUILD_ID'))){
  console.log('Preparing this checkout for first use.');
  const build=spawnSync(process.execPath,['scripts/run-next.mjs','build'],{cwd:workspace,env,stdio:'inherit'});
  if(build.status!==0)throw new Error('Build failed. Check the message above.');
 }
 fs.mkdirSync('output/local-server',{recursive:true});
 const log=fs.openSync('output/local-server/server.log','a');
 const child=spawn(process.execPath,['scripts/run-next.mjs','start'],{cwd:workspace,env,detached:true,windowsHide:true,stdio:['ignore',log,log]});
 child.unref();fs.closeSync(log);
 console.log('Opening Sarabun from '+workspace+' ...');
 for(let i=0;i<90;i++){
  await new Promise(resolve=>setTimeout(resolve,1000));
  const result=await identity();
  if(result?.workspaceId===workspaceId){openBrowser();console.log('Ready: '+origin);return;}
 }
 throw new Error('Server did not become ready. See output/local-server/server.log.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
