import {it,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {parseEnv} from 'node:util';
import {saveGoogleClientJson} from '../src/lib/local-config';
const client=(callback='http://127.0.0.1:3000/api/google/callback')=>JSON.stringify({web:{client_id:'123-test.apps.googleusercontent.com',client_secret:'GOCSPX-test-private-secret',redirect_uris:[callback]}});
it('imports an OAuth file atomically without changing the encryption key or exposing secrets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-oauth-'));const secret='existing-secret-'.repeat(4);fs.writeFileSync(path.join(root,'.env.local'),`SESSION_SECRET='${secret}'\nAPP_PASSWORD='existing-password'\nDATABASE_PATH='./data/custom.sqlite'\n`);
 const result=saveGoogleClientJson(root,client(),'http://127.0.0.1:3000');const env=parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8'));expect(env.SESSION_SECRET).toBe(secret);expect(env.DATABASE_PATH).toBe('./data/custom.sqlite');expect(env.APP_PASSWORD).toBe('existing-password');expect(env.GOOGLE_CLIENT_SECRET).toBe('GOCSPX-test-private-secret');expect(JSON.stringify(result)).not.toContain(secret);expect(JSON.stringify(result)).not.toContain('GOCSPX');expect(result.clientChanged).toBe(true);expect(saveGoogleClientJson(root,client(),'http://127.0.0.1:3000').clientChanged).toBe(false);
});
it('rejects malformed, oversized, desktop-client and wrong-redirect files without changing settings',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-oauth-')),file=path.join(root,'.env.local'),original='SESSION_SECRET='+ 'a'.repeat(40)+'\n';fs.writeFileSync(file,original);
 for(const input of ['{', 'x'.repeat(65537),JSON.stringify({installed:{client_id:'fake'}}),client('https://example.com/api/google/callback')]){expect(()=>saveGoogleClientJson(root,input,'http://127.0.0.1:3000')).toThrow();expect(fs.readFileSync(file,'utf8')).toBe(original);}
});
