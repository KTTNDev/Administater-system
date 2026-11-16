import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="http://127.0.0.1:3107",root=path.resolve("output/procurement-stage-a"),report=JSON.parse(await fs.readFile(path.join(root,"validation.json"),"utf8"));
const results=[];
for(const scenario of ["short","long","longer","columns"]){
  const record=report.scenarios.find(s=>s.scenario===scenario);const form=new FormData();form.set("requestId",randomUUID());form.set("file",new Blob([await fs.readFile(path.join(root,"word-qa-"+scenario+".docx"))]),"native-word-"+scenario+".docx");
  const response=await fetch(origin+"/api/procurement-lab/"+record.documentId+"/review",{method:"POST",headers:{Origin:origin},body:form});if(!response.ok)throw Error(await response.text());const {review}=await response.json();const changed=review.diffs.filter(d=>!["same","matching"].includes(d.kind)).map(d=>d.key).sort();
  const diffs=review.diffs.filter(d=>!["same","matching"].includes(d.kind));
  assert.deepEqual(changed,scenario==="long"?["date","number","vendorName"]:scenario==="longer"?["vendorName"]:[]);
  if(scenario==="longer")assert.equal(diffs[0].kind,"system");
  results.push({scenario,changed,diffs,unmapped:review.unmapped,reviewId:review.id});
}
await fs.writeFile(path.join(root,"native-word-roundtrip-validation.json"),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
