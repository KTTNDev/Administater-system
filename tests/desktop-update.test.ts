import {afterAll,beforeAll,expect,test} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {makeUpdate,verifyUpdate,applyUpdate,rollback} from '../scripts/update-desktop.mjs';

const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-update-test-'));
const launcher=`import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
const root=process.cwd(),r=JSON.parse(fs.readFileSync('.desktop/current.json','utf8'));
if(process.argv[2]==='start'&&r.appVersion==='1.0.1'&&fs.existsSync('FAIL-START')){const d=new DatabaseSync('data/sarabun.sqlite');d.exec("UPDATE documents SET text='migration-in-progress'");d.close();process.exit(1)}
console.log('fixture '+process.argv[2]);`;
function setup(name:string,version='old'){
 const root=path.join(sandbox,name);fs.mkdirSync(path.join(root,'.desktop/versions',version,'app'),{recursive:true});fs.mkdirSync(path.join(root,'.desktop/runtime'),{recursive:true});fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'data'));
 fs.copyFileSync(process.execPath,path.join(root,'.desktop/runtime/node.exe'));
 const release={version,appVersion:version==='old'?'1.0.0':'1.0.1',node:process.version,platform:process.platform,arch:process.arch,built:new Date().toISOString()};
 fs.writeFileSync(path.join(root,'.desktop/current.json'),JSON.stringify(release));fs.writeFileSync(path.join(root,'.desktop/versions',version,'app/server.js'),'// fixture');
 for(const file of ['desktop.mjs','backup-worker.mjs','workspace-backup.mjs','export-desktop.mjs','restore-backup.mjs','configure-production.mjs','setup-production.ps1','update-desktop.mjs','update-desktop.ps1'])fs.copyFileSync(path.join('scripts',file),path.join(root,'scripts',file));
 fs.writeFileSync(path.join(root,'scripts/desktop.mjs'),launcher);
 for(const file of ['Open-Sarabun.cmd','Stop-Sarabun.cmd','Export-Sarabun.cmd','Update-Sarabun.cmd','Rollback-Sarabun.cmd','Setup-Sarabun-Production.cmd','QUICK-START-TH.md','DESKTOP-README.md','CHANGELOG.md'])fs.copyFileSync(file,path.join(root,file));
 fs.writeFileSync(path.join(root,'.env.local'),'DATABASE_PATH=./data/sarabun.sqlite\nSESSION_SECRET=fixture-private-secret\n');
 const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));db.exec("CREATE TABLE documents(text TEXT);INSERT INTO documents VALUES('original document');CREATE TABLE settings(value TEXT);INSERT INTO settings VALUES('private setting')");db.close();return root;
}
function content(root:string){const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));try{return db.prepare('SELECT text FROM documents').get()!.text;}finally{db.close();}}
let source:string,packageRoot:string;
beforeAll(()=>{source=setup('source','new');packageRoot=makeUpdate(source,path.join(sandbox,'package'));});
afterAll(()=>{fs.rmSync(sandbox,{recursive:true,force:true});});
test('update package contains no workspace data or credentials',()=>{
 const m=verifyUpdate(packageRoot);expect(m.release.appVersion).toBe('1.0.1');expect(m.files.some((x:{name:string})=>x.name.startsWith('data/')||x.name.includes('.env'))).toBe(false);
});
test('rejects changed files and traversal paths before touching installation',()=>{
 const p=path.join(sandbox,'tampered');fs.cpSync(packageRoot,p,{recursive:true});fs.appendFileSync(path.join(p,'Open-Sarabun.cmd'),'tampered');expect(()=>verifyUpdate(p)).toThrow(/checksum/);
 const m=JSON.parse(fs.readFileSync(path.join(p,'update-manifest.json'),'utf8'));m.files[0].name='.desktop/versions/new/app/../../../../outside';fs.writeFileSync(path.join(p,'update-manifest.json'),JSON.stringify(m));expect(()=>verifyUpdate(p)).toThrow(/path/i);
});
test('updates without changing data, rolls back to matching data, and preserves later work in rescue snapshot',()=>{
 const root=setup('success');const env=fs.readFileSync(path.join(root,'.env.local'),'utf8');const result=applyUpdate(root,packageRoot);expect(result.version).toBe('1.0.1');expect(content(root)).toBe('original document');expect(fs.readFileSync(path.join(root,'.env.local'),'utf8')).toBe(env);
 const db=new DatabaseSync(path.join(root,'data/sarabun.sqlite'));db.exec("UPDATE documents SET text='work after update'");db.close();const back=rollback(root);expect(content(root)).toBe('original document');
 const rescue=new DatabaseSync(path.join(back.rescue,'database.sqlite'),{readOnly:true});expect(rescue.prepare('SELECT text FROM documents').get()!.text).toBe('work after update');rescue.close();expect(JSON.parse(fs.readFileSync(path.join(root,'.desktop/current.json'),'utf8')).version).toBe('old');expect(applyUpdate(root,packageRoot).version).toBe('1.0.1');
});
test('failed startup restores both prior program and database after a partial migration',()=>{
 const root=setup('failure');fs.writeFileSync(path.join(root,'FAIL-START'),'1');expect(()=>applyUpdate(root,packageRoot)).toThrow(/previous version retained/);expect(content(root)).toBe('original document');expect(JSON.parse(fs.readFileSync(path.join(root,'.desktop/current.json'),'utf8')).version).toBe('old');expect(fs.existsSync(path.join(root,'.desktop/pending-update.json'))).toBe(false);
});
test('interrupted update journal can recover without a completed update record',()=>{
 const root=setup('interrupted');applyUpdate(root,packageRoot);const last=JSON.parse(fs.readFileSync(path.join(root,'.desktop/last-update.json'),'utf8'));fs.renameSync(path.join(root,'.desktop/last-update.json'),path.join(root,'.desktop/pending-update.json'));rollback(root);expect(content(root)).toBe('original document');expect(fs.existsSync(path.join(root,'.desktop/pending-update.json'))).toBe(false);expect(fs.existsSync(path.join(root,last.backup,'database.sqlite'))).toBe(true);
});
