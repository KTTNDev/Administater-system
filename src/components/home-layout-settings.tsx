'use client';
import {useEffect,useState} from 'react';
import {SettingsSections} from './settings-sections';
import {HomeClock} from './home-clock';
import {homeCanvasPresets,homeCanvasStyle} from '@/lib/home-canvas';
import {ArrowDown,ArrowUp,ImagePlus,Plus,Save,Settings2,Trash2,Undo2} from 'lucide-react';
import {defaultHomeLayout,homeClockFonts,homeHeroOpacity,homeArt,homeCardFocus,homeLayoutSchema,homeMenus,homeTones,newHomeCard,type HomeCard,type HomeLayout,type HomeLayoutSnapshot,type HomeTarget} from '@/lib/home-layout';
import {getHomeLayout,prepareHomeImage,saveHomeLayout} from '@/app/home-layout-actions';
import {HomeShortcutCard} from './home-shortcuts';
import {ImageFocusEditor} from './image-focus-editor';
import {MenuHeaderSettings} from './menu-header-settings';
import {defaultImageFocus} from '@/lib/image-focus';

type Props={snapshot:HomeLayoutSnapshot;onSaved:(value:HomeLayoutSnapshot)=>void;onDirty:(value:boolean)=>void;onBusy:(value:boolean)=>void};
export function HomeLayoutSettings({snapshot,onSaved,onDirty,onBusy}:Props){
 const [clockPreviewTime,setClockPreviewTime]=useState<Date|null>(null);
 useEffect(()=>setClockPreviewTime(new Date()),[]);
 const [layout,setLayout]=useState(snapshot.layout),[saved,setSaved]=useState(snapshot),[selected,setSelected]=useState(snapshot.layout.cards[0]?.id||''),[newTarget,setNewTarget]=useState<HomeTarget>('inventory');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [ready,setReady]=useState(false);
 // This panel is loaded separately from the app toolbar. Disable SSR inputs
 // until their handlers attach, so an early Back click cannot lose typed data.
 useEffect(()=>{setReady(true)},[]);
 const dirty=JSON.stringify(layout)!==JSON.stringify(saved.layout),card=layout.cards.find(c=>c.id===selected),index=layout.cards.findIndex(c=>c.id===selected);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 function patch(value:Partial<HomeLayout>){setLayout(p=>({...p,...value}));setError('');setNotice('');}
 function editCard(value:Partial<HomeCard>){setLayout(p=>({...p,cards:p.cards.map(c=>c.id===selected?{...c,...value}:c)}));setError('');setNotice('');}
 function move(offset:number){const cards=[...layout.cards],to=index+offset;if(index<0||to<0||to>=cards.length)return;[cards[index],cards[to]]=[cards[to],cards[index]];patch({cards});}
 async function upload(file:File|undefined,kind:'card'|'hero'){
  if(!file)return;setError('');setNotice('');if(file.size>5*1024*1024){setError('เลือกรูปขนาดไม่เกิน 5 MB');return;}
  setBusy(true);try{const form=new FormData();form.set('file',file);const result=await prepareHomeImage(form);if(!result.ok)throw Error(result.error);
   if(kind==='hero')patch({heroImage:result.image,heroBackground:'image',heroFocus:defaultImageFocus()});else editCard({image:result.image,background:'image',focusX:50,focusY:50,zoom:100});
   setNotice('เตรียมรูปแล้ว กดบันทึกเมื่อตรวจตัวอย่างเรียบร้อย');
  }catch(e){setError(e instanceof Error?e.message:'เตรียมรูปไม่สำเร็จ');}finally{setBusy(false);}
 }
 async function save(){
  const parsed=homeLayoutSchema.safeParse(layout);if(!parsed.success){setError(parsed.error.issues[0]?.message||'ตรวจสอบข้อมูลหน้าหลัก');return;}
  setBusy(true);setError('');setNotice('');try{const result=await saveHomeLayout(parsed.data,saved.version);if(!result.ok)throw Error(result.error);setSaved(result.data);setLayout(result.data.layout);onSaved(result.data);setNotice('บันทึกหน้าหลักแล้ว รวมพื้นหลังส่วนหัวเมนู ใช้ได้ทันทีเมื่อเปิดเมนูนั้น');}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }
 async function reload(){if(dirty&&!confirm('โหลดค่าที่บันทึกไว้และละทิ้งการแก้ไขในตัวอย่างนี้หรือไม่?'))return;setBusy(true);setError('');try{const latest=await getHomeLayout();setSaved(latest);setLayout(latest.layout);setSelected(latest.layout.cards[0]?.id||'');onSaved(latest);setNotice('โหลดค่าล่าสุดแล้ว');}catch{setError('โหลดค่าล่าสุดไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}
 function sectionDirty(keys:(keyof HomeLayout)[]){return keys.some(key=>JSON.stringify(layout[key])!==JSON.stringify(saved.layout[key]));}
 const toggles=[['showTyping','ข้อความความสามารถระบบ'],['showClock','นาฬิกาและวันที่'],['showSummary','แถบสรุปงานวันนี้'],['showTasks','รายการงาน'],['showProjects','โครงการประจำปี'],['showDocuments','ทางลัดเลือกแบบหนังสือ']] as const;
 return <section className="panel settings-card home-layout-settings" aria-labelledby="home-layout-title" data-state={busy?'loading':error?'error':notice?'success':'default'}>
  <header className="home-settings-heading"><div><h2 id="home-layout-title"><Settings2 size={21}/>ปรับแต่งหน้าหลัก</h2><p>เลือกงานที่เปิดบ่อย จัดลำดับ และเปลี่ยนภาพของแต่ละทางลัด</p></div><a href="/home" target="_blank" rel="noreferrer">เปิดหน้าหลัก ↗</a></header>
  <fieldset disabled={busy||!ready} className="home-settings-fields">
   <SettingsSections id="home-appearance" label="ส่วนปรับแต่งหน้าหลัก" compact sections={[
    {id:'shortcuts',label:'เมนูทางลัด',dirty:sectionDirty(['cards']),content:<>   <div className="home-menu-workbench">
    <section className="home-menu-list" aria-label="รายการทางลัดหน้าหลัก"><h3>เมนูบนหน้าหลัก <small>{layout.cards.filter(c=>c.visible).length} แสดง / {layout.cards.length} ทั้งหมด</small></h3>
     <div className="home-menu-rows">{layout.cards.map((c,i)=><div key={c.id} className="home-menu-row" data-selected={c.id===selected}>
      <input type="checkbox" aria-label={'แสดงทางลัด '+c.label} checked={c.visible} onChange={e=>patch({cards:layout.cards.map(item=>item.id===c.id?{...item,visible:e.target.checked}:item)})}/>
      <button type="button" aria-pressed={c.id===selected} onClick={()=>setSelected(c.id)}><span>{i+1}. {c.label}</span><small>{homeMenus[c.target].label}{!c.visible?' · ซ่อนอยู่':''}</small></button>
     </div>)}{!layout.cards.length&&<p className="home-help">ยังไม่มีทางลัด เลือกเมนูด้านล่างแล้วกดเพิ่ม</p>}</div>
     <label>เลือกเมนูที่จะเพิ่ม<select value={newTarget} onChange={e=>setNewTarget(e.target.value as HomeTarget)}>{Object.entries(homeMenus).map(([key,menu])=><option key={key} value={key}>{menu.label}</option>)}</select></label>
     <button type="button" disabled={layout.cards.length>=16} onClick={()=>{const next=newHomeCard(newTarget,crypto.randomUUID());patch({cards:[...layout.cards,next]});setSelected(next.id);}}><Plus size={16}/>เพิ่มทางลัด{layout.cards.length>=16?' (ครบ 16 รายการ)':''}</button>
    </section>
    <section className="home-card-editor" aria-label="แก้ไขทางลัดที่เลือก">{card?<>
     <div className="home-card-toolbar"><h3>แก้ไข: {card.label||'ทางลัดใหม่'}</h3><div><button type="button" aria-label="เลื่อนทางลัดขึ้น" disabled={index===0} onClick={()=>move(-1)}><ArrowUp size={16}/></button><button type="button" aria-label="เลื่อนทางลัดลง" disabled={index===layout.cards.length-1} onClick={()=>move(1)}><ArrowDown size={16}/></button><button type="button" aria-label="ลบทางลัดที่เลือก" onClick={()=>{patch({cards:layout.cards.filter(c=>c.id!==selected)});setSelected(layout.cards[index+1]?.id||layout.cards[index-1]?.id||'');}}><Trash2 size={16}/></button></div></div>
     <div className="home-settings-grid"><label>ชื่อปุ่มเมนู<input maxLength={60} value={card.label} onChange={e=>editCard({label:e.target.value})}/></label><label>เปิดหน้า<select value={card.target} onChange={e=>editCard({target:e.target.value as HomeTarget})}>{Object.entries(homeMenus).map(([key,menu])=><option key={key} value={key}>{menu.label}</option>)}</select></label>
      <label>โทนสี<select value={card.tone} onChange={e=>editCard({tone:e.target.value as HomeCard['tone']})}>{Object.entries(homeTones).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>พื้นหลังการ์ด<select value={card.background} onChange={e=>editCard({background:e.target.value as HomeCard['background']})}><option value="illustration">ภาพประกอบของระบบ</option><option value="solid">สีพื้น</option><option value="image">รูปของฉัน</option></select></label>
      {card.background==='illustration'&&<label>ภาพประกอบ<select value={card.art} onChange={e=>editCard({art:e.target.value as HomeCard['art']})}>{Object.keys(homeArt).map((key,i)=><option key={key} value={key}>{['เอกสาร','รายการงาน','แผนโครงการ','พัสดุ','รายงาน','พื้นที่จัดเก็บ'][i]}</option>)}</select></label>}
      {card.background==='image'&&<div className="home-photo-control"><label><ImagePlus size={16}/>รูปพื้นหลังการ์ด<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0],'card');e.target.value='';}}/></label>{card.image&&<button type="button" onClick={()=>editCard({image:'',background:'solid'})}>ลบรูปการ์ด</button>}</div>}
      {card.background!=='solid'&&<><label>ความเข้มของภาพ {Math.round(card.opacity*100)}%<input type="range" min="0" max="60" step="5" value={Math.round(card.opacity*100)} onChange={e=>editCard({opacity:Number(e.target.value)/100})}/></label><label>ตำแหน่งภาพ<select value={card.focusX===undefined?card.position:'custom'} onChange={e=>editCard({position:e.target.value as HomeCard['position'],focusX:undefined})}><option value="left">ซ้าย</option><option value="center">กลาง</option><option value="right">ขวา</option><option value="custom" disabled>กำหนดจุดโฟกัสเอง</option></select></label></>}
     </div>
     <div className="wd-launchers home-custom-shortcuts home-single-preview" data-card-size={layout.cardSize}><HomeShortcutCard card={card} onClick={()=>{}}/></div>
     {card.background!=='solid'&&<details className="home-display-options" open={card.background==='image'}><summary>เลื่อนและซูมภาพการ์ด</summary><ImageFocusEditor src={card.background==='image'?card.image:homeArt[card.art]} value={homeCardFocus(card)} onChange={focus=>editCard({focusX:focus.x,focusY:focus.y,zoom:focus.zoom})} label="ตำแหน่งภาพการ์ด" kind={layout.cardSize==='compact'?'compact':'card'} fit={card.background==='image'?'cover':'art'} artHeight={layout.cardSize==='compact'?130:180} opacity={card.opacity}/></details>}
     <p className="home-help">ตัวอย่างการ์ดที่เลือก · รูป JPG / PNG / WebP ไม่เกิน 5 MB ระบบย่อรูปและลบข้อมูลประกอบภาพก่อนเก็บ</p>
    </>:<p className="home-help">เพิ่มหรือเลือกทางลัดเพื่อแก้ไข</p>}</section>
   </div>
   <details className="home-display-options"><summary>ดูตัวอย่างเมนูทั้งหมด</summary><div className="wd-launchers home-custom-shortcuts home-all-preview" data-card-size={layout.cardSize}>{layout.cards.filter(c=>c.visible).map(c=><HomeShortcutCard key={c.id} card={c} onClick={()=>setSelected(c.id)}/>)}</div><p className="home-help">กดการ์ดในตัวอย่างเพื่อเลือกแก้ไข เมนูจะเริ่มใช้งานจริงหลังบันทึก</p></details>
</>},
    {id:'background',label:'พื้นหลังหน้าหลัก',dirty:sectionDirty(['title','cardSize','heroBackground','heroImage','heroFocus','heroOpacity','heroMotion','canvasColor',...toggles.map(([key])=>key)]),content:<>   <details className="home-display-options" open><summary>ส่วนหัวและองค์ประกอบหน้าหลัก</summary><div className="home-settings-grid">
    <label>ชื่อที่แสดงบนหน้าหลัก<input maxLength={60} value={layout.title} onChange={e=>patch({title:e.target.value})}/></label>
    <label>ขนาดการ์ด<select value={layout.cardSize} onChange={e=>patch({cardSize:e.target.value as HomeLayout['cardSize']})}><option value="comfortable">ปกติ · ภาพเด่น</option><option value="compact">กะทัดรัด · เห็นหลายเมนู</option></select></label>
    <label>พื้นหลังส่วนหัว<select value={layout.heroBackground} onChange={e=>patch({heroBackground:e.target.value as HomeLayout['heroBackground']})}><option value="coast">ภาพชายฝั่งของระบบ</option><option value="plain">สีพื้นเรียบ</option><option value="image">รูปของฉัน</option></select></label>
    {layout.heroBackground!=='plain'&&<label className="home-background-opacity">ความชัดภาพพื้นหลัง ({Math.round(homeHeroOpacity(layout)*100)}%)<input type="range" aria-label="ความชัดภาพพื้นหลังหน้าหลัก" min={0} max={100} step={1} value={Math.round(homeHeroOpacity(layout)*100)} onChange={e=>patch({heroOpacity:Number(e.target.value)/100})}/><small>0% ซ่อนภาพ · เลื่อนเพิ่มเพื่อให้ภาพชัดขึ้น</small></label>}
    <div className="home-background-preview" aria-label="ตัวอย่างความชัดพื้นหลังหน้าหลัก">
     {(layout.heroBackground==='coast'||layout.heroBackground==='image'&&!!layout.heroImage)&&<img alt="" src={layout.heroBackground==='image'?layout.heroImage:'/media/home-coast-poster.png'} style={{opacity:homeHeroOpacity(layout),objectPosition:layout.heroBackground==='image'?layout.heroFocus.x+'% '+layout.heroFocus.y+'%':'center',transform:'scale('+(layout.heroBackground==='image'?layout.heroFocus.zoom/100:1)+')',transformOrigin:layout.heroFocus.x+'% '+layout.heroFocus.y+'%'}}/>}
     <strong>{layout.title}</strong>
    </div>
    <label className="home-check"><input type="checkbox" checked={layout.heroMotion} onChange={e=>patch({heroMotion:e.target.checked})}/>เล่นวิดีโอพื้นหลังอัตโนมัติ</label>
    {layout.heroBackground==='image'&&<div className="home-photo-control"><label>รูปพื้นหลังส่วนหัว<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0],'hero');e.target.value='';}}/></label>{layout.heroImage&&<><img alt="ตัวอย่างพื้นหลังส่วนหัว" src={layout.heroImage} style={{opacity:homeHeroOpacity(layout)}}/><button type="button" onClick={()=>patch({heroImage:'',heroBackground:'plain'})}>ลบรูปส่วนหัว</button></>}</div>}
    {layout.heroBackground==='image'&&layout.heroImage&&<ImageFocusEditor src={layout.heroImage} value={layout.heroFocus} onChange={heroFocus=>patch({heroFocus})} kind="hero" label="ตำแหน่งภาพส่วนหัวหน้าหลัก" opacity={homeHeroOpacity(layout)}/>}
    <div className="home-widget-options">{toggles.map(([key,label])=><label className="home-check" key={key}><input type="checkbox" checked={layout[key]} onChange={e=>patch({[key]:e.target.checked})}/>{label}</label>)}</div>
   </div></details>
   <details className="home-display-options home-canvas-settings" open><summary>สีพื้นหลังหน้าหลัก</summary>
    <div className="home-canvas-presets" role="group" aria-label="เลือกสีพื้นหลังหน้าหลัก">{homeCanvasPresets.map(preset=><button type="button" key={preset.label} aria-pressed={layout.canvasColor===preset.color} onClick={()=>patch({canvasColor:preset.color})}><i aria-hidden="true" style={{background:preset.color||"var(--ui-rest)"}}/>{preset.label}</button>)}</div>
    <label className="home-canvas-color">เลือกสีเอง<input type="color" aria-label="สีพื้นหลังหน้าหลักที่กำหนดเอง" value={layout.canvasColor||"#f7f6f2"} onChange={e=>patch({canvasColor:e.target.value})}/><span>{layout.canvasColor||"สีเดิมของระบบ"}</span></label>
    <div className="home-canvas-preview" aria-label="ตัวอย่างสีพื้นหลังและข้อความ" style={homeCanvasStyle(layout.canvasColor||"#f7f6f2")}>
     <strong>โต๊ะทำงาน</strong><span>งานวันนี้ · เกินกำหนด · ปฏิทินงาน</span>
     <div className="home-canvas-sample-card"><strong>รายการงาน</strong><span>ตัวอย่างการ์ดบนพื้นหลังที่เลือก</span></div>
    </div>
    <p className="home-help">ข้อความนอกการ์ดเลือกสีดำหรือขาวอัตโนมัติเพื่อให้อ่านตัดกับพื้นหลัง กดบันทึกหน้าหลักเพื่อใช้สีนี้</p>
   </details>
</>},
    {id:'clock',label:'นาฬิกาและวันที่',dirty:sectionDirty(['clockFont','clockSize','dateFont','dateSize']),content:<>   <details className="home-display-options home-clock-settings" open><summary>นาฬิกาและวันที่</summary>
    <div className="home-settings-grid">
     <label>ฟอนต์นาฬิกา<select value={layout.clockFont} onChange={e=>patch({clockFont:e.target.value as HomeLayout['clockFont']})}>{Object.entries(homeClockFonts).map(([key,font])=><option key={key} value={key}>{font.label}</option>)}</select></label>
     <label>ขนาดนาฬิกา ({layout.clockSize} px)<input type="range" aria-label="ขนาดนาฬิกา" min={24} max={112} step={2} value={layout.clockSize} onChange={e=>patch({clockSize:Number(e.target.value)})}/></label>
     <label>ฟอนต์วันที่<select value={layout.dateFont} onChange={e=>patch({dateFont:e.target.value as HomeLayout['dateFont']})}>{Object.entries(homeClockFonts).map(([key,font])=><option key={key} value={key}>{font.label}</option>)}</select></label>
     <label>ขนาดวันที่ ({layout.dateSize} px)<input type="range" aria-label="ขนาดวันที่" min={12} max={40} value={layout.dateSize} onChange={e=>patch({dateSize:Number(e.target.value)})}/></label>
    </div>
    <div className="home-clock-preview" aria-label="ตัวอย่างนาฬิกาและวันที่"><HomeClock layout={layout} now={clockPreviewTime}/></div>
    <p className="home-help">ดูตัวอย่างแล้วกดบันทึกหน้าหลัก ฟอนต์ทั้ง 4 แบบเก็บไว้ในโปรแกรมและใช้ได้แบบออฟไลน์</p>
   </details>
</>},
    {id:'headers',label:'ส่วนหัวเมนู',dirty:sectionDirty(['headers']),content:<>   <MenuHeaderSettings headers={layout.headers} onChange={headers=>patch({headers})} onBusy={setBusy} onError={setError} onMessage={setNotice}/>
</>},
   ]}/>
  </fieldset>
  {error&&<p role="alert" className="home-settings-error">{error}</p>}{notice&&<p role="status" className="home-settings-success">{notice}</p>}
  {dirty&&<p className="home-settings-pending">มีข้อมูลยังไม่บันทึก · ปุ่มบันทึกจะใช้การแก้ไขทั้ง 4 ส่วน</p>}
  <footer className="home-settings-footer"><button type="button" className="primary" disabled={busy||!dirty} onClick={()=>void save()}><Save size={16}/>{busy?'กำลังประมวลผล…':'บันทึกหน้าหลัก'}</button><button type="button" disabled={busy||!dirty} onClick={()=>{setLayout(saved.layout);setSelected(saved.layout.cards[0]?.id||'');setError('');setNotice('ยกเลิกการแก้ไขที่ยังไม่บันทึกแล้ว');}}>ยกเลิกการแก้ไข</button><button type="button" disabled={busy} onClick={()=>void reload()}>โหลดค่าที่บันทึก</button><button type="button" disabled={busy} onClick={()=>{const defaults=defaultHomeLayout();setLayout(defaults);setSelected(defaults.cards[0].id);setError('');setNotice('คืนค่าเริ่มต้นในตัวอย่างแล้ว กดบันทึกเพื่อใช้จริง');}}><Undo2 size={16}/>คืนค่าเริ่มต้น</button></footer>
  <p className="home-help">ใช้ร่วมกันในโปรแกรมเครื่องนี้ · เก็บในฐานข้อมูลและชุดสำรอง · การซ่อนหรือลบทางลัดไม่ลบงาน เมนูยังเปิดจากไซด์บาร์ได้</p>
 </section>;
}
