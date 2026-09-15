import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const workspace=process.cwd();
const mode=process.argv[2]||"dev";
if(!["dev","build","start"].includes(mode))throw new Error("Unknown mode");
const configFile=path.join(workspace,".runtime-local.json");
let runtime=workspace;
if(fs.existsSync(configFile)){
  runtime=path.resolve(JSON.parse(fs.readFileSync(configFile,"utf8")).path);
  const marker=path.join(runtime,"sarabun-workspace.marker");
  if(!fs.existsSync(marker)||fs.readFileSync(marker,"utf8").replace(/^\uFEFF/,"").trim()!==workspace.trim())throw new Error("Runtime marker does not match this workspace");
}
const mirrored=["src","public","tests","next.config.ts","tsconfig.json","next-env.d.ts","package.json","package-lock.json","vitest.config.ts","playwright.config.ts",".env.local"];
function sync(name){
  if(runtime===workspace)return;
  const source=path.join(workspace,name),target=path.join(runtime,name);
  if(!mirrored.some(p=>name===p||name.startsWith(p+path.sep)))return;
  if(fs.existsSync(source)){
    if(fs.statSync(source).isDirectory()){
      fs.mkdirSync(target,{recursive:true});
      for(const file of fs.readdirSync(source))sync(path.join(name,file));
    }else{
      const bytes=fs.readFileSync(source);
      if(!fs.existsSync(target)||!fs.readFileSync(target).equals(bytes)){
        fs.mkdirSync(path.dirname(target),{recursive:true});
        try { fs.writeFileSync(target,bytes); }
        catch(error) { if(error?.code!=="EPERM"&&error?.code!=="EBUSY") throw error; console.warn(`Runtime file locked; using existing copy: ${target}`); }
      }
    }
  }else if(fs.existsSync(target)&&fs.statSync(target).isFile())fs.unlinkSync(target);
}
for(const name of mirrored)sync(name);
const args=[path.join(runtime,"node_modules","next","dist","bin","next"),mode];
if(mode!=="build")args.push("--hostname","127.0.0.1");
args.push(...process.argv.slice(3));
const child=spawn(process.execPath,args,{cwd:runtime,stdio:"inherit",env:{...process.env,SARABUN_SOURCE_DIR:workspace}});
const watchers=[];const timers=new Map();
if(mode==="dev"&&runtime!==workspace){
  console.log(`Source: ${workspace} | Runtime: ${runtime}`);
  for(const directory of ["src","public","tests"]){
    watchers.push(fs.watch(path.join(workspace,directory),{recursive:true},(_event,file)=>{
      if(!file)return;const name=path.join(directory,file.toString());clearTimeout(timers.get(name));timers.set(name,setTimeout(()=>{try{sync(name)}catch(e){console.error("Source sync failed:",e.message)}},180));
    }));
  }
  watchers.push(fs.watch(workspace,(_event,file)=>{if(file&&mirrored.includes(file.toString())){try{sync(file.toString())}catch(e){console.error("Config sync failed:",e.message)}}}));
}
child.on("exit",code=>{for(const watcher of watchers)watcher.close();for(const timer of timers.values())clearTimeout(timer);process.exit(code??1)});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
