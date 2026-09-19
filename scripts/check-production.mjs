import fs from 'node:fs';
import path from 'node:path';
const workspace=process.cwd();
try{
 process.loadEnvFile(path.join(workspace,'.env.local'));
 if((process.env.APP_PASSWORD||'').length<12)throw new Error('Set APP_PASSWORD to at least 12 characters in .env.local.');
 if((process.env.SESSION_SECRET||'').length<32)throw new Error('Set SESSION_SECRET to at least 32 characters in .env.local.');
 if(process.env.APP_URL!=='http://127.0.0.1:3000')throw new Error('This local launcher requires APP_URL=http://127.0.0.1:3000.');
 const config=path.join(workspace,'.runtime-local.json');
 const runtime=fs.existsSync(config)?path.resolve(JSON.parse(fs.readFileSync(config,'utf8')).path):workspace;
 if(!fs.existsSync(path.join(runtime,'.next','BUILD_ID')))throw new Error('Run npm run build before starting production.');
 console.log('Production configuration is ready.');
}catch(error){console.error(error.message);process.exitCode=1;}
