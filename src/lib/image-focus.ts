import {z} from 'zod';
export const imageFocusSchema=z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100),zoom:z.number().min(100).max(250)});
export type ImageFocus=z.infer<typeof imageFocusSchema>;
export const defaultImageFocus=():ImageFocus=>({x:50,y:50,zoom:100});
export function focusPosition(focus:ImageFocus){return `${focus.x}% ${focus.y}%`;}
export function imageDisplayBox(width:number,height:number,naturalWidth:number,naturalHeight:number,focus:ImageFocus,fit:'cover'|'art'='cover',artHeight=210){
 if(!width||!height||!naturalWidth||!naturalHeight)return {width:0,height:0,left:0,top:0};
 const scale=(fit==='cover'?Math.max(width/naturalWidth,height/naturalHeight):artHeight/naturalHeight)*focus.zoom/100;
 const displayedWidth=naturalWidth*scale,displayedHeight=naturalHeight*scale;
 return {width:displayedWidth,height:displayedHeight,left:(width-displayedWidth)*focus.x/100,top:(height-displayedHeight)*focus.y/100};
}
export function dragImageFocus(start:ImageFocus,dx:number,dy:number,overflowX:number,overflowY:number):ImageFocus {
 const clamp=(n:number)=>Math.round(Math.max(0,Math.min(100,n))*10)/10;
 return {...start,x:Math.abs(overflowX)<.5?start.x:clamp(start.x-dx/overflowX*100),y:Math.abs(overflowY)<.5?start.y:clamp(start.y-dy/overflowY*100)};
}
