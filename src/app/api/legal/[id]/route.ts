import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){await requireUser();const parsed=z.string().uuid().safeParse((await params).id);if(!parsed.success)return new Response("Invalid ID",{status:400});const row=db().prepare("SELECT file FROM legal_library WHERE id=?").get(parsed.data);if(!row?.file)return new Response("Not found",{status:404});return new Response(new Uint8Array(row.file as Uint8Array),{headers:{"Content-Type":"application/pdf","Content-Disposition":(new URL(_request.url).searchParams.get("inline")==="1"?"inline":"attachment")+"; filename=legal-reference.pdf","Cache-Control":"private, no-store"}});}
