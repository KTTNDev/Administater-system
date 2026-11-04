import {z} from 'zod';
import {defaultImageFocus,imageFocusSchema,type ImageFocus} from './image-focus';

// UI configuration only. No document, print, or numbering settings belong here.
export const homeMenus={
 templates:{label:'หนังสือราชการ',category:'documents',art:'documents'},
 dashboard:{label:'เอกสารของฉัน',category:'documents',art:'documents'},
 tasks:{label:'งานของฉัน',category:'tasks',art:'tasks'},
 projects:{label:'โครงการประจำปี',category:'projects',art:'projects'},
 register:{label:'ทะเบียนรับ–ส่ง',category:'documents',art:'documents'},
 inventory:{label:'พัสดุและครุภัณฑ์',category:'inventory',art:'inventory'},
 reports:{label:'ภาพรวมและรายงาน',category:'reports',art:'reports'},
 budget:{label:'โอนงบประมาณ',category:'reports',art:'reports'},
 office:{label:'งานธุรการ',category:'tasks',art:'tasks'},
 calendar:{label:'ปฏิทินงาน',category:'calendar',art:'projects'},
 bookings:{label:'จองห้องประชุม',category:'calendar',art:'projects'},
 laws:{label:'คลังกฎหมาย',category:'reference',art:'documents'},
 guide:{label:'คู่มือใช้งาน',category:'reference',art:'documents'},
 settings:{label:'ตั้งค่าระบบ',category:'reference',art:'cloud'},
} as const;
export type HomeTarget=keyof typeof homeMenus;
export const headerMenus={...homeMenus,editor:{label:'หน้าจัดทำร่างหนังสือ',category:'documents',art:'documents'}} as const;
export type HeaderTarget=keyof typeof headerMenus;
export const homeArt={documents:'/illustrations/home-documents.svg',tasks:'/illustrations/home-tasks.svg',projects:'/illustrations/home-annual-plan.svg',inventory:'/illustrations/workspace-inventory.svg',reports:'/illustrations/workspace-reports.svg',cloud:'/illustrations/workspace-cloud.svg'} as const;
export const homeTones={documents:'ฟ้า',tasks:'พีช',projects:'เขียว',inventory:'ครีม',reports:'ม่วง',calendar:'มิ้นต์',reference:'เทาอุ่น'} as const;
export const homeImageSchema=z.string().max(220000).regex(/^(?:|data:image\/webp;base64,[A-Za-z0-9+/]+={0,2})$/);
export const headerAppearanceSchema=z.object({
 background:z.enum(['default','illustration','solid','image']),tone:z.enum(['default','documents','tasks','projects','inventory','reports','calendar','reference']),
 art:z.enum(['documents','tasks','projects','inventory','reports','cloud']),image:homeImageSchema,opacity:z.number().min(0).max(.6),focus:imageFocusSchema,
}).refine(value=>value.background!=='image'||!!value.image,'เลือกรูปพื้นหลังส่วนหัวของเมนูที่กำหนด');
export type HeaderAppearance=z.infer<typeof headerAppearanceSchema>;
export function defaultHeaderAppearance(target:HeaderTarget):HeaderAppearance{return {background:'default',tone:'default',art:headerMenus[target].art,image:'',opacity:.25,focus:{x:85,y:50,zoom:100}};}
export const homeCardSchema=z.object({
 id:z.string().regex(/^[a-zA-Z0-9-]{1,60}$/),target:z.enum(Object.keys(homeMenus) as [HomeTarget,...HomeTarget[]]),
 label:z.string().trim().min(1).max(60),visible:z.boolean(),tone:z.enum(['documents','tasks','projects','inventory','reports','calendar','reference']),
 background:z.enum(['illustration','solid','image']),art:z.enum(['documents','tasks','projects','inventory','reports','cloud']),image:homeImageSchema,
 opacity:z.number().min(0).max(.6),position:z.enum(['left','center','right']),
 focusX:z.number().min(0).max(100).optional(),focusY:z.number().min(0).max(100).default(50),zoom:z.number().min(100).max(250).default(100),
});
export type HomeCard=z.infer<typeof homeCardSchema>;
export const homeLayoutSchema=z.object({
 title:z.string().trim().min(1).max(60),showTyping:z.boolean(),showClock:z.boolean(),showSummary:z.boolean(),showTasks:z.boolean(),showProjects:z.boolean(),showDocuments:z.boolean(),
 cardSize:z.enum(['comfortable','compact']),heroBackground:z.enum(['coast','image','plain']),heroImage:homeImageSchema,heroMotion:z.boolean(),
 cards:z.array(homeCardSchema).max(16),
 heroFocus:imageFocusSchema.default(defaultImageFocus),
 headers:z.partialRecord(z.enum(Object.keys(headerMenus) as [HeaderTarget,...HeaderTarget[]]),headerAppearanceSchema).default({}),
}).superRefine((layout,ctx)=>{
 if(new Set(layout.cards.map(c=>c.id)).size!==layout.cards.length)ctx.addIssue({code:'custom',message:'รหัสเมนูซ้ำกัน'});
 if(layout.heroBackground==='image'&&!layout.heroImage)ctx.addIssue({code:'custom',message:'เลือกรูปพื้นหลังส่วนหัวก่อน'});
 if(layout.cards.some(c=>c.background==='image'&&!c.image))ctx.addIssue({code:'custom',message:'เลือกรูปพื้นหลังให้ครบทุกเมนูที่ใช้รูปส่วนตัว'});
 if(JSON.stringify(layout).length>4*1024*1024)ctx.addIssue({code:'custom',message:'รูปพื้นหลังรวมมีขนาดใหญ่เกินไป กรุณาลดจำนวนรูปส่วนตัว'});
});
export type HomeLayout=z.infer<typeof homeLayoutSchema>;
export type HomeLayoutSnapshot={layout:HomeLayout;version:number};
export function newHomeCard(target:HomeTarget,id:string):HomeCard {
 const menu=homeMenus[target];return {id,target,label:menu.label,visible:true,tone:menu.category,background:'illustration',art:menu.art,image:'',opacity:.5,position:'right',focusY:50,zoom:100};
}
export function defaultHomeLayout():HomeLayout {
 return {title:'sarabun',showTyping:true,showClock:true,showSummary:true,showTasks:true,showProjects:true,showDocuments:true,cardSize:'comfortable',heroBackground:'coast',heroImage:'',heroMotion:true,heroFocus:defaultImageFocus(),headers:{},
 cards:[newHomeCard('templates','default-documents'),newHomeCard('tasks','default-tasks'),newHomeCard('projects','default-projects')]};
}
export function homeCardImage(card:HomeCard){return card.background==='solid'?'none':`url("${card.background==='image'?card.image:homeArt[card.art]}")`;}
export function homeCardFocus(card:HomeCard):ImageFocus{return {x:card.focusX??({left:0,center:50,right:100}[card.position]),y:card.focusY,zoom:card.zoom};}
export function headerAppearanceStyle(value:HeaderAppearance){
 const tone=value.tone;
 return {
  '--custom-header-image':value.background==='image'?`url("${value.image}")`:value.background==='illustration'?`url("${homeArt[value.art]}")`:'none',
  '--custom-header-position':`${value.focus.x}% ${value.focus.y}%`,'--custom-header-scale':value.focus.zoom/100,
  '--custom-header-size':value.background==='image'?'cover':'auto 210px','--custom-header-opacity':value.opacity,
  '--custom-header-surface':tone==='default'?'var(--category-soft)':`var(--category-${tone})`,
  '--custom-header-ink':tone==='default'?'var(--category-ink)':`var(--category-${tone}-ink)`,
 };
}
export const homeLayoutSql="id TEXT PRIMARY KEY CHECK(id='home'),data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL";
