import {describe,it,expect} from 'vitest';
import {homeCanvasInk,homeCanvasStyle} from '../src/lib/home-canvas';
import {defaultHomeLayout,homeLayoutSchema} from '../src/lib/home-layout';
function luminance(hex:string){
 const channels=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
describe('solid Home background',()=>{
 it('defaults legacy layouts to the original color and accepts only full hex colors',()=>{
  const legacy:Record<string,unknown>={...defaultHomeLayout()};delete legacy.canvasColor;
  expect(homeLayoutSchema.parse(legacy).canvasColor).toBe('');
  for(const color of ['#ffffff','#000000','#aAbBcC','#777777'])expect(homeLayoutSchema.safeParse({...legacy,canvasColor:color}).success).toBe(true);
  for(const color of ['red','#fff','#111111;display:none','url(https://example.com)',' #ffffff'])expect(homeLayoutSchema.safeParse({...legacy,canvasColor:color}).success).toBe(false);
 });
 it('chooses readable text and overdue status across an sRGB color grid',()=>{
  for(const r of [0,51,102,153,204,255])for(const g of [0,51,102,153,204,255])for(const b of [0,51,102,153,204,255]){
   const hex='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
   expect(contrast(hex,homeCanvasInk(hex))).toBeGreaterThanOrEqual(4.5);
   const style=homeCanvasStyle(hex) as Record<string,string>;
   expect(contrast(hex,style['--home-canvas-danger'])).toBeGreaterThanOrEqual(4.5);
  }
  expect(homeCanvasInk('#ffffff')).toBe('#000000');expect(homeCanvasInk('#000000')).toBe('#ffffff');
 });
});
