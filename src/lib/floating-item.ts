import type {Draft} from "./document";

export type FloatingImage = Extract<Draft["floatingItems"][number], {kind:"image"}>;
export type AppendixImage = Draft["appendixImages"][number];
export const isSignature = (item:Draft["floatingItems"][number]):item is FloatingImage => item.kind==="image" && item.purpose==="signature";
export const isFreeAppendixImage = (item:AppendixImage):boolean => item.xMm!==undefined && item.yMm!==undefined;

// Keep the image inside A4 when its width or position changes.
export function fitFloatingImage(item:FloatingImage, patch:Partial<Pick<FloatingImage,"xMm"|"yMm"|"widthMm"|"page">>={}):FloatingImage {
 const next={...item,...patch},ratio=item.image.height/item.image.width;
 const widthMm=Math.max(10,Math.min(180,297/ratio,next.widthMm));
 const round=(n:number)=>Math.round(n*10)/10;
 return {...next,widthMm:round(widthMm),xMm:round(Math.max(0,Math.min(195,210-widthMm,next.xMm))),yMm:round(Math.max(0,Math.min(285,297-widthMm*ratio,next.yMm)))};
}

export function fitAppendixImage(item:AppendixImage, patch:Partial<Pick<AppendixImage,"xMm"|"yMm"|"widthMm"|"page">>={}):AppendixImage {
 const next={...item,...patch},ratio=item.height/item.width;
 const round=(n:number)=>Math.round(n*10)/10;
 const widthMm=round(Math.max(20,Math.min(195,280/ratio,next.widthMm)));
 if(next.xMm===undefined||next.yMm===undefined)return {...next,widthMm,page:undefined,xMm:undefined,yMm:undefined};
 return {
  ...next,
  widthMm,
  page:Math.max(1,Math.min(100,Math.round(next.page??1))),
  xMm:round(Math.max(0,Math.min(195,210-widthMm,next.xMm))),
  yMm:round(Math.max(0,Math.min(285,297-widthMm*ratio,next.yMm))),
 };
}

export function sameOverlayContent(a:Draft,b:Draft){
 const content=(draft:Draft)=>({
  ...draft,
  floatingItems:draft.floatingItems.map(({xMm,yMm,widthMm,page,...item})=>item),
  appendixImages:draft.appendixImages.map(({xMm,yMm,widthMm,page,...item})=>({...item,free:xMm!==undefined&&yMm!==undefined})),
 });
 return JSON.stringify(content(a))===JSON.stringify(content(b));
}
