import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
export const localDemo = () => process.env.NODE_ENV === "development" && process.env.LOCAL_DEMO === "true";
export function secret() { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error("กรุณาตั้ง SESSION_SECRET อย่างน้อย 32 ตัวอักษร"); return value; }
export function validPassword(value: string) {
  if (!process.env.APP_PASSWORD || process.env.APP_PASSWORD.length < 12) return false;
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(value), hash(process.env.APP_PASSWORD));
}
export async function authenticated() {
  if (localDemo()) return true;
  const token = (await cookies()).get("sarabun-session")?.value;
  if (!token) return false;
  try { const {payload} = await jwtVerify(token, new TextEncoder().encode(secret()), { issuer:"sarabun", audience:"workspace" }); return payload.sub === "operator"; } catch { return false; }
}
export async function requireUser() { if (!await authenticated()) throw new Error("กรุณาเข้าสู่ระบบใหม่"); }
export async function createSession() {
  const token = await new SignJWT({}).setProtectedHeader({alg:"HS256"}).setSubject("operator").setIssuer("sarabun").setAudience("workspace").setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(secret()));
  (await cookies()).set("sarabun-session",token,{httpOnly:true,secure:process.env.APP_URL?.startsWith("https://"),sameSite:"lax",path:"/",maxAge:28800});
}
