import {notFound} from "next/navigation";
import {guardLab} from "@/lib/procurement-lab/server";
import {templateSession} from "@/lib/procurement-lab/template";
import {TemplateEditor} from "./template-editor";
export const dynamic="force-dynamic";
export default async function Page(){try{await guardLab();}catch{notFound();}const session=await templateSession();return <TemplateEditor {...session}/>;}
