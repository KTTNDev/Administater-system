import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ status: "ready", application: "sarabun", mode: process.env.NODE_ENV === "production" ? "start" : "dev", instance: process.env.SARABUN_DESKTOP_INSTANCE || null, pid: process.env.SARABUN_DESKTOP_INSTANCE ? process.pid : null }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "http://127.0.0.1:3001" } });
}
