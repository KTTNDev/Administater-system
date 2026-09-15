import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DocumentAssets } from "./render-document";
let cached: DocumentAssets | undefined;
export function documentAssets(): DocumentAssets {
  const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync(path.join(process.cwd(),"public",file)).toString("base64")}`;
  return cached ||= {regular:data("fonts/THSarabunNew.ttf","font/ttf"),bold:data("fonts/THSarabunNew-Bold.ttf","font/ttf"),garuda:data("assets/garuda.png","image/png")};
}
