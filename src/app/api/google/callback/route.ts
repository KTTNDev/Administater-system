import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { drive as createDrive } from "@googleapis/drive";
import { requireUser } from "@/lib/auth";
import { oauthClient,encrypt } from "@/lib/drive";
import { db,setSetting } from "@/lib/db";
export const runtime="nodejs";
export async function GET(request:NextRequest) {
  const origin=process.env.APP_URL||"http://127.0.0.1:3000";
  try {
    await requireUser(); const jar=await cookies(),stored=jar.get("google-state")?.value,state=request.nextUrl.searchParams.get("state"),code=request.nextUrl.searchParams.get("code");jar.set("google-state","",{httpOnly:true,sameSite:"lax",path:"/api/google/callback",maxAge:0,secure:process.env.APP_URL?.startsWith("https://")});
    if(!stored||!state||stored.length!==state.length||!timingSafeEqual(Buffer.from(stored),Buffer.from(state))||!code)throw new Error("Invalid OAuth state");
    const auth=oauthClient(),{tokens}=await auth.getToken(code);if(!tokens.refresh_token)throw new Error("Missing refresh token");auth.setCredentials(tokens);
    const {data}=await createDrive({version:"v3",auth}).about.get({fields:"user(emailAddress,permissionId)"});
    db().transaction(()=>{db().prepare("DELETE FROM settings WHERE key LIKE 'drive:%'").run();setSetting("google:token",encrypt(tokens.refresh_token!));setSetting("google:email",data.user?.emailAddress||"");setSetting("google:account",data.user?.permissionId||"");})();
    return NextResponse.redirect(new URL("/?view=settings&google=connected",origin));
  } catch {return NextResponse.redirect(new URL("/?view=settings&google=error",origin));}
}

