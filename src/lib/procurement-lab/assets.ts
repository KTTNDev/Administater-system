import "server-only";
import fs from "node:fs";
import path from "node:path";
export type LabAssets={regular:string;bold:string};
let cache:LabAssets|undefined;
export function labAssets():LabAssets{
  return cache??=(Object.fromEntries(["regular","bold"].map(k=>[k,"data:font/ttf;base64,"+fs.readFileSync(path.join(process.cwd(),"public/fonts",k==="bold"?"THSarabunNew-Bold.ttf":"THSarabunNew.ttf")).toString("base64")])) as LabAssets);
}
