import { NextResponse } from "next/server";
export function GET(){return NextResponse.json({status:"ready",application:"sarabun",mode:process.env.NODE_ENV==="production"?"start":"dev"},{headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"http://127.0.0.1:3001"}})}
