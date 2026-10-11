'use server';
import {requireUser,loginRequired} from '@/lib/auth';
import {driveStatus} from '@/lib/drive';
import {db} from '@/lib/db';
import {saveGoogleClientJson} from '@/lib/local-config';
import {parseEnv} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
export async function getSetupReadiness(){
 await requireUser();const root=process.env.SARABUN_SOURCE_DIR||process.cwd();
 return {loginRequired:loginRequired(),desktopMode:(process.env.SARABUN_DESKTOP_TOKEN||'').length===64,passwordReady:(process.env.APP_PASSWORD||'').length>=12,secretReady:(process.env.SESSION_SECRET||'').length>=32,production:process.env.NODE_ENV==='production',drive:driveStatus(),callback:(process.env.APP_URL||'http://127.0.0.1:3000').replace(/\/$/,'')+'/api/google/callback',setupPath:path.join(root,'Setup-Sarabun-Production.cmd'),launcherPath:path.join(root,'Open-Sarabun.cmd')};
}
export async function importGoogleClient(input:string){
 await requireUser();const root=process.env.SARABUN_SOURCE_DIR||process.cwd();
 try {
 const result=saveGoogleClientJson(root,input,process.env.APP_URL||'http://127.0.0.1:3000');
 const values=parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8'));
 process.env.GOOGLE_CLIENT_ID=values.GOOGLE_CLIENT_ID;process.env.GOOGLE_CLIENT_SECRET=values.GOOGLE_CLIENT_SECRET;
 if(!process.env.SESSION_SECRET)process.env.SESSION_SECRET=values.SESSION_SECRET;
 if(!process.env.APP_URL)process.env.APP_URL=values.APP_URL;
 if(result.clientChanged)db().prepare("DELETE FROM settings WHERE key LIKE 'google:%' OR key LIKE 'drive:%'").run();
 return {ok:true as const,data:result};
 }catch(error){return {ok:false as const,error:error instanceof Error?error.message:"นำเข้าไฟล์ตั้งค่าไม่สำเร็จ"};}
}
