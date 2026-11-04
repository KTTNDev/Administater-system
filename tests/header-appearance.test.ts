import {expect,it} from 'vitest';
import {defaultHeaderAppearance,defaultHomeLayout,headerAppearanceStyle,headerMenus,homeCardFocus,homeLayoutSchema,type HeaderTarget} from '../src/lib/home-layout';
import {dragImageFocus,imageDisplayBox} from '../src/lib/image-focus';
it('reads legacy layout without losing the old left/center/right card positions',()=>{
 const old:any=defaultHomeLayout();delete old.headers;delete old.heroFocus;for(const card of old.cards){delete card.focusY;delete card.zoom;delete card.focusX;}
 const layout=homeLayoutSchema.parse(old);expect(layout.headers).toEqual({});expect(layout.heroFocus).toEqual({x:50,y:50,zoom:100});expect(homeCardFocus(layout.cards[0])).toEqual({x:100,y:50,zoom:100});
 expect(homeCardFocus({...layout.cards[0],position:'left'}).x).toBe(0);expect(homeCardFocus({...layout.cards[0],focusX:35}).x).toBe(35);
});
it('supports every menu plus the editor, with separate validated background settings',()=>{
 const layout=defaultHomeLayout();for(const key of Object.keys(headerMenus) as HeaderTarget[])layout.headers[key]={...defaultHeaderAppearance(key),background:'solid',tone:'calendar'};
 const parsed=homeLayoutSchema.parse(layout);expect(Object.keys(parsed.headers)).toHaveLength(15);expect(headerAppearanceStyle(parsed.headers.tasks!)['--custom-header-surface']).toBe('var(--category-calendar)');
 parsed.headers.tasks!.tone='reports';expect(parsed.headers.inventory!.tone).toBe('calendar');
});
it('rejects unrecognized menus, remote/HTML images and unbounded focus settings',()=>{
 const layout=defaultHomeLayout(),header={...defaultHeaderAppearance('tasks'),background:'image',image:'data:text/html;base64,AAA='};
 expect(homeLayoutSchema.safeParse({...layout,headers:{tasks:header}}).success).toBe(false);
 expect(homeLayoutSchema.safeParse({...layout,headers:{unknown:defaultHeaderAppearance('tasks')}}).success).toBe(false);
 for(const focus of [{x:-1,y:50,zoom:100},{x:50,y:101,zoom:100},{x:50,y:50,zoom:99},{x:50,y:50,zoom:251}])expect(homeLayoutSchema.safeParse({...layout,headers:{tasks:{...defaultHeaderAppearance('tasks'),focus}}}).success).toBe(false);
});
it('matches cover cropping for landscape and portrait photos and anchors zoom to the chosen focus',()=>{
 const landscape=imageDisplayBox(300,200,1000,200,{x:100,y:50,zoom:100});expect(landscape).toEqual({width:1000,height:200,left:-700,top:0});
 const portrait=imageDisplayBox(300,150,300,600,{x:50,y:100,zoom:100});expect(portrait).toEqual({width:300,height:600,left:0,top:-450});
 const zoomed=imageDisplayBox(300,150,300,600,{x:25,y:75,zoom:200});expect(zoomed).toEqual({width:600,height:1200,left:-75,top:-787.5});
});
it('supports illustration placement without stretching or forcing it to cover the header',()=>{
 expect(imageDisplayBox(1000,150,100,200,{x:100,y:50,zoom:100},'art',210)).toEqual({width:105,height:210,left:895,top:-30});
});
it('drags in image coordinates, clamps at image edges and keeps fitted axes steady',()=>{
 expect(dragImageFocus({x:50,y:50,zoom:150},100,-100,200,400)).toEqual({x:0,y:75,zoom:150});
 expect(dragImageFocus({x:50,y:50,zoom:100},-9999,9999,200,400)).toEqual({x:100,y:0,zoom:100});
 expect(dragImageFocus({x:50,y:50,zoom:100},100,100,0,0)).toEqual({x:50,y:50,zoom:100});
 expect(dragImageFocus({x:50,y:50,zoom:100},20,0,-200,0)).toEqual({x:60,y:50,zoom:100});
});
