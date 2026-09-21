import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {parseEnv} from 'node:util';import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/configure-production.mjs');
const run=(folder:string,password:string)=>spawnSync(process.execPath,[script],{cwd:folder,input:JSON.stringify({password}),encoding:'utf8'});
it('sets a password without exposing it or rotating the existing Drive encryption key',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-setup-')),file=path.join(folder,'.env.local');
 const secret='existing-secret-'.repeat(4);fs.writeFileSync(file,`SESSION_SECRET=${secret}\nGOOGLE_CLIENT_ID=keep-client\nAPP_PASSWORD=old\nDATABASE_PATH=./data/existing.sqlite\n`);
 const password='รหัสทดสอบ # $ back\\slash';const result=run(folder,password);expect(result.status,result.stderr).toBe(0);
 const env=parseEnv(fs.readFileSync(file,'utf8'));expect(env.APP_PASSWORD).toBe(password);expect(env.SESSION_SECRET).toBe(secret);expect(env.GOOGLE_CLIENT_ID).toBe('keep-client');expect(env.DATABASE_PATH).toBe('./data/existing.sqlite');expect(result.stdout+result.stderr).not.toContain(password);expect(result.stdout+result.stderr).not.toContain(secret);
});
it('rejects invalid passwords without changing configuration and initializes a missing session key',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-setup-')),file=path.join(folder,'.env.local'),original='# local settings\n';fs.writeFileSync(file,original);
 for(const password of ['short','has-newline-\nunsafe',`both-quotes-'"-invalid`]){expect(run(folder,password).status).toBe(1);expect(fs.readFileSync(file,'utf8')).toBe(original);}
 expect(run(folder,'valid-long-password').status).toBe(0);expect(parseEnv(fs.readFileSync(file,'utf8')).SESSION_SECRET?.length).toBeGreaterThanOrEqual(32);
});
