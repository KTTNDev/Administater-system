import fs from "node:fs/promises";
import path from "node:path";
const origin="http://127.0.0.1:3107",out=path.resolve("output/procurement-stage-a");
const report=JSON.parse(await fs.readFile(path.join(out,"validation.json"),"utf8"));
for(const s of report.scenarios){const result=await fetch(origin+"/api/procurement-lab/"+s.documentId);const {document}=await result.json();const response=await fetch(origin+"/api/procurement-lab/"+s.documentId+"/pdf",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({version:document.version})});if(!response.ok)throw Error(await response.text());await fs.writeFile(path.join(out,"D07-"+s.scenario+".pdf"),Buffer.from(await response.arrayBuffer()));console.log("PDF refreshed",s.scenario);}
