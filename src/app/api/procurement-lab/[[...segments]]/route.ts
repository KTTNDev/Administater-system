import {labHandler} from "@/lib/procurement-lab/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{segments?:string[]}>};
async function handle(request:Request,context:Context){return labHandler(request,(await context.params).segments||[]);}
export {handle as GET,handle as POST,handle as PUT};
