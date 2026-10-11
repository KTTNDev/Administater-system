import { timingSafeEqual } from "node:crypto";
import { createSession } from "@/lib/auth";
export async function POST(request: Request) {
  const expected = process.env.SARABUN_DESKTOP_TOKEN || "";
  if (expected.length !== 64 || request.headers.get("origin") !== "http://127.0.0.1:3000" || request.headers.get("host") !== "127.0.0.1:3000") return new Response(null, { status: 403 });
  let token: unknown;
  try { token = (await request.json()).token; } catch { return new Response(null, { status: 400 }); }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return new Response(null, { status: 403 });
  await createSession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
