import {expect,it} from "vitest";
import {fitFloatingImage,isSignature,sameOverlayContent,type FloatingImage} from "../src/lib/floating-item";
import {documentSchema,newDraft} from "../src/lib/document";
const item:FloatingImage={kind:"image",purpose:"signature",id:"00000000-0000-4000-8000-000000000001",page:1,xMm:175,yMm:280,widthMm:45,image:{id:"00000000-0000-4000-8000-000000000002",name:"signature.png",mime:"image/png",bytes:100,width:240,height:80}};
it("keeps a resized signature inside the right and bottom A4 edges",()=>{
 const result=fitFloatingImage(item,{widthMm:100});expect(result.widthMm).toBe(100);expect(result.xMm+result.widthMm).toBeLessThanOrEqual(210);expect(result.yMm+result.widthMm/3).toBeLessThanOrEqual(297.05);
});
it("caps portrait image size and clamps negative placement",()=>{
 const result=fitFloatingImage({...item,image:{...item.image,width:80,height:240}},{widthMm:180,xMm:-8,yMm:-9});expect(result.widthMm).toBe(99);expect(result.xMm).toBe(0);expect(result.yMm).toBe(0);
});
it("persists the signature purpose while older image drafts remain valid",()=>{
 const {purpose,...old}=item;const parsed=documentSchema.parse({...newDraft(),subject:"test",floatingItems:[item,{...old,id:"00000000-0000-4000-8000-000000000003"}]});expect(isSignature(parsed.floatingItems[0])).toBe(true);expect(isSignature(parsed.floatingItems[1])).toBe(false);
});

it("only skips preview rebuilding when overlay geometry alone changes",()=>{
 const a={...newDraft(),floatingItems:[item]},b={...a,floatingItems:[{...item,page:2,xMm:50,widthMm:80}]};
 expect(sameOverlayContent(a,b)).toBe(true);
 expect(sameOverlayContent(a,{...b,subject:"changed"})).toBe(false);
 expect(sameOverlayContent(a,{...b,floatingItems:[]})).toBe(false);
});
