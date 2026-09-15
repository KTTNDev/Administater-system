import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { oauthClient } from "@/lib/drive";
export const runtime="nodejs";
export async function GET() {
  try {
    await requireUser();const client=oauthClient(),state=randomBytes(32).toString("hex");
    (await cookies()).set("google-state",state,{httpOnly:true,sameSite:"lax",secure:process.env.APP_URL?.startsWith("https://"),maxAge:600,path:"/api/google/callback"});
    return NextResponse.redirect(client.generateAuthUrl({access_type:"offline",prompt:"consent",scope:["https://www.googleapis.com/auth/drive.file"],state}));
  } catch { return NextResponse.redirect(new URL("/?view=settings&google=setup",process.env.APP_URL||"http://127.0.0.1:3000")); }
}
