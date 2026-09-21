'use server';
import {requireUser} from '@/lib/auth';
import {driveStatus} from '@/lib/drive';
import path from 'node:path';
export async function getSetupReadiness(){
 await requireUser();const root=process.env.SARABUN_SOURCE_DIR||process.cwd();
 return {passwordReady:(process.env.APP_PASSWORD||'').length>=12,secretReady:(process.env.SESSION_SECRET||'').length>=32,production:process.env.NODE_ENV==='production',drive:driveStatus(),callback:(process.env.APP_URL||'http://127.0.0.1:3000').replace(/\/$/,'')+'/api/google/callback',setupPath:path.join(root,'Setup-Sarabun-Production.cmd'),launcherPath:path.join(root,'Open-Sarabun-Production.cmd')};
}
