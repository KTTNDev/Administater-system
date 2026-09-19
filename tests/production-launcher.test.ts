import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
it('blocks missing production credentials and build, then accepts a configured installation without printing secrets',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-production-'));
 const run=()=>spawnSync(process.execPath,[path.resolve('scripts/check-production.mjs')],{cwd:folder,encoding:'utf8',env:{...process.env,APP_PASSWORD:'',SESSION_SECRET:'',APP_URL:''}});
 fs.writeFileSync(path.join(folder,'.env.local'),'APP_URL=http://127.0.0.1:3000\n');expect(run().status).toBe(1);
 const secret='test-secret-'.repeat(4),password='test-password-long';
 fs.writeFileSync(path.join(folder,'.env.local'),`APP_URL=http://127.0.0.1:3000\nAPP_PASSWORD=${password}\nSESSION_SECRET=${secret}\n`);
 // Node loadEnvFile preserves existing variables, so use a clean environment for configured checks.
 const env={...process.env};delete env.APP_PASSWORD;delete env.SESSION_SECRET;delete env.APP_URL;
 const configured=()=>spawnSync(process.execPath,[path.resolve('scripts/check-production.mjs')],{cwd:folder,encoding:'utf8',env});
 expect(configured().status).toBe(1);fs.mkdirSync(path.join(folder,'.next'));fs.writeFileSync(path.join(folder,'.next','BUILD_ID'),'test');
 const result=configured();expect(result.status).toBe(0);expect(result.stdout+result.stderr).not.toContain(secret);expect(result.stdout+result.stderr).not.toContain(password);
});
