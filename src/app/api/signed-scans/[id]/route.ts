import { requireUser } from "@/lib/auth";
import { readSignedScan } from "@/lib/signed-scans";
import { z } from "zod";

export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{await requireUser();}catch{return new Response("Unauthorized",{status:401});}
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success)return new Response("Invalid ID",{status:400});
  try{
    const file=readSignedScan(id);
    const mode=new URL(request.url).searchParams.get("download")==="1"?"attachment":"inline";
    return new Response(new Uint8Array(file.file),{headers:{
      "Content-Type":file.mime,
      "Content-Disposition":mode+"; filename=\"signed-scan\"; filename*=UTF-8''"+encodeURIComponent(file.name),
      "Content-Length":String(file.bytes),
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Referrer-Policy":"no-referrer",
    }});
  }catch{return new Response("Not found",{status:404});}
}
