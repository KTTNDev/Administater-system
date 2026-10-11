import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {documentHtml} from "../../src/lib/render-document";
import {newDraft} from "../../src/lib/document";
const data=(file:string)=>`data:image/png;base64,${fs.readFileSync("public/"+file).toString("base64")}`;
const assets={regular:`data:font/ttf;base64,${fs.readFileSync("public/fonts/THSarabunNew.ttf").toString("base64")}`,bold:`data:font/ttf;base64,${fs.readFileSync("public/fonts/THSarabunNew-Bold.ttf").toString("base64")}`,garuda:data("assets/garuda.png"),routingStamp:data("assets/approval-routing-stamp.png"),copyMark:data("assets/copy-counterpart.png")};
const source=data("assets/garuda.png");
const image=(id:string,width:number,height:number,caption:string)=>({id,name:`${caption}.png`,mime:"image/png" as const,bytes:100,width,height,caption,widthMm:width/height>1?165:80});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;

for(const [name,images,layout] of [
 ["landscape pair",[image(id(1),1600,900,"แนวนอน 1"),image(id(2),1600,900,"แนวนอน 2")],"landscape-pair"],
 ["portrait pair",[image(id(3),900,1600,"แนวตั้ง 1"),image(id(4),900,1600,"แนวตั้ง 2")],"portrait-pair"],
 ["mixed pair",[image(id(5),1600,900,"แนวนอน"),image(id(6),900,1600,"แนวตั้ง")],"mixed-pair"],
] as const)test(`appendix layout supports ${name} on one A4 page`,async({page})=>{
 const appendixImages=[...images],sources=Object.fromEntries(appendixImages.map(item=>[item.id,source]));
 await page.setContent(documentHtml({...newDraft("external"),appendixTitle:"ภาพหลักฐานประกอบ",appendixImages},assets,sources));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 const sheets=page.locator(".appendix-sheet");await expect(sheets).toHaveCount(1);await expect(sheets).toHaveClass(new RegExp(layout));await expect(sheets.locator(".appendix-figure")).toHaveCount(2);
 const metrics=await sheets.locator(".appendix-figure").evaluateAll(figures=>figures.map(item=>{const r=item.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}}));
 if(layout==="portrait-pair"){expect(Math.abs(metrics[0].top-metrics[1].top)).toBeLessThan(4);expect(metrics[1].left).toBeGreaterThan(metrics[0].left)}else expect(metrics[1].top).toBeGreaterThan(metrics[0].top);
 expect(await page.locator(".page").count()).toBe(2);
 await page.locator(".page").nth(1).screenshot({path:`output/appendix-${name.replaceAll(" ","-")}.png`});
});

test("four appendix images use two images per sheet",async({page})=>{
 const appendixImages=[image(id(10),1600,900,"ภาพ 1"),image(id(11),1600,900,"ภาพ 2"),image(id(12),1600,900,"ภาพ 3"),image(id(13),1600,900,"ภาพ 4")],sources=Object.fromEntries(appendixImages.map(item=>[item.id,source]));
 await page.setContent(documentHtml({...newDraft("external"),appendixTitle:"ภาพประกอบ",appendixImages},assets,sources));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 await expect(page.locator(".appendix-sheet")).toHaveCount(2);for(const sheet of await page.locator(".appendix-sheet").all())await expect(sheet.locator(".appendix-figure")).toHaveCount(2);await expect(page.locator(".page")).toHaveCount(3);
});
