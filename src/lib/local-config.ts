import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
export function saveGoogleClientJson(root:string,input:string,origin:string){
 if(typeof input!=='string'||Buffer.byteLength(input,'utf8')>65536)throw new Error('เลือกไฟล์ JSON ของ OAuth Client ขนาดไม่เกิน 64 KB');
 let parsed:unknown;try{parsed=JSON.parse(input.replace(/^\uFEFF/,''));}catch{throw new Error('อ่านไฟล์ JSON ไม่สำเร็จ');}
 const web=(parsed as {web?:{client_id?:unknown;client_secret?:unknown;redirect_uris?:unknown}})?.web;
 if(!web||typeof web.client_id!=='string'||!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(web.client_id)||typeof web.client_secret!=='string'||web.client_secret.length<8||web.client_secret.length>500||/[\r\n\0]/.test(web.client_secret))throw new Error('ใช้ไฟล์ OAuth Client ประเภท Web application ที่ดาวน์โหลดจาก Google Cloud');
 const base=new URL(origin);
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('APP_URL ต้องเป็นที่อยู่เว็บไซต์ของระบบ');
 const callback=base.origin+'/api/google/callback';
 if(!Array.isArray(web.redirect_uris)||!web.redirect_uris.includes(callback))throw new Error('Redirect URI ในไฟล์ต้องมี '+callback);
 const file=path.join(root,'.env.local');
 let source=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''):'';
 const previous=parseEnv(source);
 if(previous.SESSION_SECRET&&previous.SESSION_SECRET.length<32)throw new Error('คีย์เดิมสั้นเกินไป กรุณาตรวจการตั้งค่าก่อน ไม่เปลี่ยนคีย์เข้ารหัสเดิมให้อัตโนมัติ');
 const updates:Record<string,string>={GOOGLE_CLIENT_ID:web.client_id,GOOGLE_CLIENT_SECRET:web.client_secret};
 if(!previous.SESSION_SECRET)updates.SESSION_SECRET=randomBytes(48).toString('hex');
 if(!previous.APP_URL)updates.APP_URL=base.origin;
 for(const [key,value] of Object.entries(updates)){
  if(value.includes("'")&&value.includes('"'))throw new Error('รูปแบบข้อมูลในไฟล์ตั้งค่าไม่ถูกต้อง');
  const quote=value.includes("'")?'"':"'",line=key+'='+quote+value+quote,matcher=new RegExp('^\\s*(?:export\\s+)?'+key+'\\s*=');
  source=source.split(/\r?\n/).filter(row=>!matcher.test(row)).join('\n')+'\n'+line;
 }
 const result=parseEnv(source);
 if(Object.entries(updates).some(([key,value])=>result[key]!==value))throw new Error('บันทึกรูปแบบการตั้งค่าไม่สำเร็จ');
 const temporary=file+'.'+randomBytes(8).toString('hex');
 try{fs.writeFileSync(temporary,source.trimEnd()+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return {configured:true,clientChanged:previous.GOOGLE_CLIENT_ID!==web.client_id,callback};
}
