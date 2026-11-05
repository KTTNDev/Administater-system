import type {CSSProperties} from 'react';

export const homeCanvasPresets=[
 {label:'สีเดิม',color:''},
 {label:'เทาอ่อน',color:'#e2e4e7'},
 {label:'เทาเข้ม',color:'#41464d'},
 {label:'ชาร์โคล',color:'#292d32'},
 {label:'เกือบดำ',color:'#16181c'},
] as const;

// WCAG relative luminance for the six-digit sRGB colors allowed by the schema.
function luminance(hex:string){
 const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255);
 const linear=channels.map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function contrast(first:string,second:string){
 const a=luminance(first),b=luminance(second);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function homeCanvasInk(background:string){
 return contrast(background,'#000000')>=contrast(background,'#ffffff')?'#000000':'#ffffff';
}
export function homeCanvasStyle(background:string){
 const ink=homeCanvasInk(background);
 const danger=['#a12b23','#ffb4ab',ink].find(color=>contrast(background,color)>=4.5)!;
 return {'--home-canvas-color':background,'--home-canvas-ink':ink,'--home-canvas-danger':danger} as CSSProperties;
}
