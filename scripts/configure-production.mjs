import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function configureProduction(workspace,password){
 if(typeof password!=='string'||password.length<12||password.length>128||/[\r\n\0]/.test(password)||password.trim()!==password)throw new Error('Use 12–128 characters without leading/trailing spaces or newlines.');
 if(password.includes("'")&&password.includes('"'))throw new Error('Use only one kind of quote character in the password.');
 const file=path.join(workspace,'.env.local');
 let source=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''):'';
 const previous=parseEnv(source);
 // Preserve the encryption key: rotating it would invalidate existing Drive tokens.
 if(previous.SESSION_SECRET&&previous.SESSION_SECRET.length<32)throw new Error('Existing SESSION_SECRET is too short. Ask the administrator to review it before changing it.');
 const put=(key,value)=>{
  const quote=value.includes("'")?'"':"'";
  const line=`${key}=${quote}${value}${quote}`;
  const matcher=new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);let found=false;
  source=source.split(/\r?\n/).filter(row=>{if(!matcher.test(row))return true;if(found)return false;found=true;return true;}).map(row=>matcher.test(row)?line:row).join('\n');
  if(!found)source+='\n'+line;
 };
 put('APP_PASSWORD',password);
 if(!previous.SESSION_SECRET)put('SESSION_SECRET',randomBytes(48).toString('hex'));
 if(!previous.APP_URL)put('APP_URL','http://127.0.0.1:3000');
 if(!previous.DATABASE_PATH)put('DATABASE_PATH','./data/sarabun.sqlite');
 const parsed=parseEnv(source);if(parsed.APP_PASSWORD!==password)throw new Error('Password cannot be stored in the environment file format.');
 const temporary=file+'.'+randomBytes(8).toString('hex');
 try{fs.writeFileSync(temporary,source.trimEnd()+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return {configured:true,restartRequired:true,sessionKeyPreserved:!!previous.SESSION_SECRET};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const input=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));configureProduction(process.cwd(),input.password);console.log('Password saved. Existing Drive encryption key preserved. Restart the server before use.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
