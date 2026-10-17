import type {Draft} from "./document";

export type FloatingImage = Extract<Draft["floatingItems"][number], {kind:"image"}>;
export const isSignature = (item:Draft["floatingItems"][number]):item is FloatingImage => item.kind==="image" && item.purpose==="signature";

// Keep the image inside A4 when its width or position changes.
export function fitFloatingImage(item:FloatingImage, patch:Partial<Pick<FloatingImage,"xMm"|"yMm"|"widthMm"|"page">>={}):FloatingImage {
 const next={...item,...patch},ratio=item.image.height/item.image.width;
 const widthMm=Math.max(10,Math.min(180,297/ratio,next.widthMm));
 const round=(n:number)=>Math.round(n*10)/10;
 return {...next,widthMm:round(widthMm),xMm:round(Math.max(0,Math.min(195,210-widthMm,next.xMm))),yMm:round(Math.max(0,Math.min(285,297-widthMm*ratio,next.yMm)))};
}

export function sameOverlayContent(a:Draft,b:Draft){
 const content=(draft:Draft)=>({...draft,floatingItems:draft.floatingItems.map(({xMm,yMm,widthMm,page,...item})=>item)});
 return JSON.stringify(content(a))===JSON.stringify(content(b));
}
