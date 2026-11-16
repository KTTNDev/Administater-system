import {notFound} from "next/navigation";
import {guardLab} from "@/lib/procurement-lab/server";
import {initialLabDocument,readLabDocument,labSourceFiles} from "@/lib/procurement-lab/store";
import {labAssets} from "@/lib/procurement-lab/assets";
import {ProcurementLab} from "./procurement-lab";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string|string[]}>}){
  try{await guardLab();}catch{notFound();}
  const {id}=await searchParams;
  if(id!==undefined&&(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)))notFound();
  let document;try{document=id?readLabDocument(id as string):initialLabDocument();}catch{notFound();}
  return <ProcurementLab initial={document} initialFiles={labSourceFiles(document.id)} assets={labAssets()}/>;
}
