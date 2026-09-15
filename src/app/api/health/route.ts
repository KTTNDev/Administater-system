import { NextResponse } from "next/server";
export function GET(){return NextResponse.json({status:"ready"},{headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"http://127.0.0.1:3001"}})}
