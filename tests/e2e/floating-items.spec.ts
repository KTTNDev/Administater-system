import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {documentHtml} from "../../src/lib/render-document";
import {newDraft} from "../../src/lib/document";
const data=(file:string)=>`data:image/png;base64,${fs.readFileSync("public/"+file).toString("base64")}`;
const assets={regular:`data:font/ttf;base64,${fs.readFileSync("public/fonts/THSarabunNew.ttf").toString("base64")}`,bold:`data:font/ttf;base64,${fs.readFileSync("public/fonts/THSarabunNew-Bold.ttf").toString("base64")}`,garuda:data("assets/garuda.png"),routingStamp:data("assets/approval-routing-stamp.png"),copyMark:data("assets/copy-counterpart.png")};
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
test("floating text and QR image render without borders, preserve position and allow dragging",async({page})=>{
 const image={id:id(2),name:"qr.png",mime:"image/png" as const,bytes:100,width:100,height:100};
 const draft={...newDraft("external"),floatingItems:[{kind:"text" as const,id:id(1),page:1,xMm:110,yMm:135,widthMm:70,fontPt:20,bold:true,text:"หมายเหตุเพิ่มเติม"},{kind:"image" as const,id:id(3),page:1,xMm:145,yMm:170,widthMm:40,image}]};
 await page.setContent(documentHtml(draft,assets,{[image.id]:data("assets/garuda.png")}));
 await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone:boolean}).__paginationDone));
 const text=page.locator('.page:first-child .floating-item[data-overlay-id="'+id(1)+'"]');
 await expect(text).toHaveText("หมายเหตุเพิ่มเติม");expect(await text.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");expect(await text.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe("0px");
 expect(await text.evaluate(el=>getComputedStyle(el).fontSize)).toBe("26.6667px");
 await expect(page.locator('.page:first-child .floating-item[data-overlay-id="'+id(3)+'"] img')).toBeVisible();
 await text.scrollIntoViewIfNeeded();const box=await text.boundingBox();if(!box)throw new Error("missing text box");await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(box.x+46,box.y+28);await page.mouse.up();
 await expect.poll(()=>text.evaluate(el=>parseFloat((el as HTMLElement).style.left))).toBeGreaterThan(110);
});
