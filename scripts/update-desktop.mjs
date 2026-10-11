import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';

export const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function within(root,name){
 if(!name||name.includes('\\')||path.isAbsolute(name)||name.split('/').some(x=>!x||x==='.'||x==='..'||x.includes(':')))throw Error('Invalid package path');
 const target=path.resolve(root,name);if(!target.startsWith(path.resolve(root)+path.sep))throw Error('Path outside installation');
 let part=root;for(const segment of name.split('/')){part=path.join(part,segment);if(fs.existsSync(part)&&fs.lstatSync(part).isSymbolicLink())throw Error('Links are not allowed in update paths');}
 return target;
}
const controls=['desktop.mjs','backup-worker.mjs','workspace-backup.mjs','export-desktop.mjs','restore-backup.mjs','configure-production.mjs','setup-production.ps1','update-desktop.mjs','update-desktop.ps1'];
const launchers=['Open-Sarabun.cmd','Stop-Sarabun.cmd','Export-Sarabun.cmd','Update-Sarabun.cmd','Rollback-Sarabun.cmd','Setup-Sarabun-Production.cmd','QUICK-START-TH.md','DESKTOP-README.md','CHANGELOG.md'];
export function verifyUpdate(folder){
 const m=read(path.join(folder,'update-manifest.json'));
 if(m.format!==1||!/^\d+\.\d+\.\d+$/.test(m.release?.appVersion||'')||!/^[\w-]+$/.test(m.release?.version||'')||m.release.node!==process.version)throw Error('Unsupported update package or Node runtime');
 if(m.release.platform!==process.platform||m.release.arch!==process.arch)throw Error('Update is for a different platform');
 if(!Array.isArray(m.files)||m.files.length===0)throw Error('Empty update');
 const seen=new Set();
 for(const entry of m.files){
  const allowed=entry.name?.startsWith(`.desktop/versions/${m.release.version}/app/`)||controls.some(x=>entry.name==='scripts/'+x)||launchers.includes(entry.name);
  if(!allowed||seen.has(entry.name)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Unexpected update entry');seen.add(entry.name);
  const file=within(folder,entry.name);if(!fs.statSync(file).isFile()||hash(file)!==entry.sha256)throw Error('Update checksum mismatch: '+entry.name);
 }
 for(const name of [`.desktop/versions/${m.release.version}/app/server.js`,...controls.map(x=>'scripts/'+x),...launchers])if(!seen.has(name))throw Error('Incomplete update: '+name);
 return m;
}
function atomicJson(file,value){fs.writeFileSync(file+'.new',JSON.stringify(value,null,2));fs.renameSync(file+'.new',file);}
function launcher(root,command){
 const r=spawnSync(path.join(root,'.desktop/runtime/node.exe'),[path.join(root,'scripts/desktop.mjs'),command,'--no-browser'],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,SARABUN_UPDATING:'1'}});
 if(r.status!==0)throw Error((r.stderr||r.stdout||'Launcher failed').trim());
 return r.stdout;
}
function snapshot(root,folder){
 const envFile=path.join(root,'.env.local');const env=fs.existsSync(envFile)?parseEnv(fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'')):{};
 const database=path.resolve(root,env.DATABASE_PATH||'data/sarabun.sqlite');
 fs.mkdirSync(folder,{recursive:true});
 const info={database,hasDatabase:fs.existsSync(database),hasEnv:fs.existsSync(envFile),release:read(path.join(root,'.desktop/current.json')),files:[]};
 if(info.hasDatabase){const db=new DatabaseSync(database,{readOnly:true});try{db.exec("VACUUM INTO '"+path.join(folder,'database.sqlite').replaceAll("'","''")+"'");}finally{db.close();}}
 if(info.hasEnv)fs.copyFileSync(envFile,path.join(folder,'env.local'));
 for(const name of [...controls.map(x=>'scripts/'+x),...launchers]){const from=within(root,name);if(fs.existsSync(from)){const to=within(folder,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);info.files.push(name);}}
 atomicJson(path.join(folder,'snapshot.json'),info);return info;
}
function restore(root,folder){
 const saved=read(path.join(folder,'snapshot.json'));
 if(saved.hasDatabase){
  const backup=new DatabaseSync(path.join(folder,'database.sqlite'),{readOnly:true});try{if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Rollback database is damaged');}finally{backup.close();}
  // Preserve the failed/current database and its WAL beside it before replacement.
  const suffix='.before-rollback-'+Date.now();for(const ext of ['','-wal','-shm'])if(fs.existsSync(saved.database+ext))fs.renameSync(saved.database+ext,saved.database+ext+suffix);
  fs.copyFileSync(path.join(folder,'database.sqlite'),saved.database);
 }
 if(saved.hasEnv)fs.copyFileSync(path.join(folder,'env.local'),path.join(root,'.env.local'));
 for(const name of saved.files)fs.copyFileSync(within(folder,name),within(root,name));
 atomicJson(path.join(root,'.desktop/current.json'),saved.release);
}
export function makeUpdate(root,target){
 const release=read(path.join(root,'.desktop/current.json'));if(!release.appVersion)throw Error('Rebuild the desktop release first');
 fs.mkdirSync(target,{recursive:true});const names=[];
 const visit=(dir,prefix)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Cannot package links');const name=prefix+'/'+entry.name;if(entry.isDirectory())visit(path.join(dir,entry.name),name);else names.push(name);}};
 visit(path.join(root,'.desktop/versions',release.version,'app'),`.desktop/versions/${release.version}/app`);
 names.push(...controls.map(x=>'scripts/'+x),...launchers);
 const files=names.map(name=>{const from=within(root,name),to=within(target,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);return {name,sha256:hash(to)};});
 atomicJson(path.join(target,'update-manifest.json'),{format:1,release,files});verifyUpdate(target);return target;
}
export function applyUpdate(root,source){
 const m=verifyUpdate(source),current=read(path.join(root,'.desktop/current.json'));
 if(current.version===m.release.version)throw Error('This build is already installed');
 if(current.appVersion){const before=current.appVersion.split('.').map(Number),after=m.release.appVersion.split('.').map(Number);for(let i=0;i<3;i++){if(after[i]>before[i])break;if(after[i]<before[i])throw Error('Use Rollback-Sarabun.cmd to restore an older release with matching data');}}
 const destination=within(root,`.desktop/versions/${m.release.version}`);
 if(fs.existsSync(destination))for(const entry of m.files.filter(x=>x.name.startsWith('.desktop/versions/'))){const file=within(root,entry.name);if(!fs.existsSync(file)||hash(file)!==entry.sha256)throw Error('Existing build differs from update package');}
 // Validate destination paths too, before stopping or writing anything.
 for(const entry of m.files)within(root,entry.name);
 launcher(root,'stop');
 const folder=path.join(root,'.desktop/update-backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 let backedUp=false;
 try{
  snapshot(root,folder);backedUp=true;
  atomicJson(path.join(root,'.desktop/pending-update.json'),{backup:path.relative(root,folder).replaceAll('\\','/')});
  for(const entry of m.files){const to=within(root,entry.name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(within(source,entry.name),to);if(hash(to)!==entry.sha256)throw Error('Copied file differs: '+entry.name);}
  atomicJson(path.join(root,'.desktop/current.json'),m.release);
  launcher(root,'start');
  atomicJson(path.join(root,'.desktop/last-update.json'),{backup:path.relative(root,folder).replaceAll('\\','/'),version:m.release.version,at:new Date().toISOString()});
  fs.unlinkSync(path.join(root,'.desktop/pending-update.json'));
  return {version:m.release.appVersion,backup:folder};
 }catch(error){
  if(backedUp){launcher(root,'stop');restore(root,folder);launcher(root,'start');fs.unlinkSync(path.join(root,'.desktop/pending-update.json'));}
  else launcher(root,'start');
  throw Error('Update failed; previous version retained. '+error.message);
 }
}
export function rollback(root){
 const pending=path.join(root,'.desktop/pending-update.json');
 const last=read(fs.existsSync(pending)?pending:path.join(root,'.desktop/last-update.json'));if(last.rolledBack)throw Error('This update was already rolled back');
 if(!last.backup?.startsWith('.desktop/update-backups/'))throw Error('Invalid rollback location');
 const folder=within(root,last.backup);launcher(root,'stop');
 const rescue=path.join(root,'.desktop/update-backups','before-manual-rollback-'+Date.now());snapshot(root,rescue);
 try{restore(root,folder);launcher(root,'start');atomicJson(path.join(root,'.desktop/last-update.json'),{...last,rolledBack:true,rescue});if(fs.existsSync(pending))fs.unlinkSync(pending);return {rescue};}
 catch(error){launcher(root,'stop');restore(root,rescue);launcher(root,'start');throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fs.realpathSync.native(fileURLToPath(new URL('../',import.meta.url)));
 const lock=path.join(root,'.desktop/update.lock');let owned=false;
 try{
  const command=process.argv[2];
  if(command==='package'){console.log(makeUpdate(root,path.resolve(process.argv[3])));}
  else{
   if(fs.existsSync(lock)){
    const owner=read(lock);let alive=false;try{process.kill(owner.pid,0);alive=true;}catch{}
    if(alive)throw Error('Another update is running');
    fs.renameSync(lock,lock+'.interrupted-'+Date.now());
   }
   fs.writeFileSync(lock,JSON.stringify({pid:process.pid}),{flag:'wx'});owned=true;
   if(command==='apply'&&fs.existsSync(path.join(root,'.desktop/pending-update.json')))throw Error('An update was interrupted. Run Rollback-Sarabun.cmd first.');
   if(command==='apply')console.log(JSON.stringify(applyUpdate(root,path.resolve(process.argv[3]))));
   else if(command==='rollback'&&process.argv.includes('--confirm-restore'))console.log(JSON.stringify(rollback(root)));
   else throw Error('Usage: update-desktop.mjs apply <unpacked-update> | rollback --confirm-restore | package <new-folder>');
  }
 }catch(error){console.error(error.message);process.exitCode=1;}finally{if(owned)fs.unlinkSync(lock);}
}
