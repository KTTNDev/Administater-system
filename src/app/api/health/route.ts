import { NextResponse } from "next/server";
import {createHash} from 'node:crypto';
import path from 'node:path';
export const dynamic='force-dynamic';
export function GET(){const workspaceId=createHash('sha256').update(path.resolve(/* turbopackIgnore: true */ process.env.SARABUN_SOURCE_DIR||process.cwd()).toLowerCase()).digest('hex').slice(0,16);return NextResponse.json({status:"ready",application:"sarabun",workspaceId,mode:process.env.NODE_ENV==="production"?"start":"dev"},{headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"http://127.0.0.1:3001"}})}
