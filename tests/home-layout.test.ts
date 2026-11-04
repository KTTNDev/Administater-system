import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import sharp from 'sharp';
import {defaultHomeLayout,homeCardImage,homeLayoutSchema,newHomeCard} from '../src/lib/home-layout';
import {readHomeLayout,writeHomeLayout} from '../src/lib/home-layout-db';
import {db,getSetting,setSetting} from '../src/lib/db';
import {setStorage,exportWorkspace} from '../src/lib/storage';
import {prepareBackupRestore,activateBackupRestore} from '../src/lib/workspace-restore';
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('../src/lib/auth',()=>({requireUser:vi.fn(async()=>{})}));
import {requireUser} from '../src/lib/auth';
import {prepareHomeImage,saveHomeLayout} from '../src/app/home-layout-actions';
let folder:string;
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-home-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('SARABUN_SOURCE_DIR',folder);fs.mkdirSync(path.join(folder,'scripts'));fs.copyFileSync('scripts/restore-backup.mjs',path.join(folder,'scripts/restore-backup.mjs'));setStorage(path.join(folder,'files'),'','');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();vi.clearAllMocks();});
it('preserves current Home defaults and returns independent editable copies',()=>{
 const first=defaultHomeLayout(),second=defaultHomeLayout();expect(homeLayoutSchema.safeParse(first).success).toBe(true);expect(first.cards.map(c=>c.target)).toEqual(['templates','tasks','projects']);first.cards[0].label='เปลี่ยน';expect(second.cards[0].label).toBe('หนังสือราชการ');expect(readHomeLayout().version).toBe(0);
});
it('rejects arbitrary destinations, remote images, HTML data URLs, duplicates and incomplete image choices',()=>{
 const layout=defaultHomeLayout();
 expect(homeLayoutSchema.safeParse({...layout,cards:[{...layout.cards[0],target:'https://example.com'}]}).success).toBe(false);
 for(const image of ['https://example.com/a.png','data:text/html;base64,PHNjcmlwdD4=','data:image/svg+xml;base64,AAA='])expect(homeLayoutSchema.safeParse({...layout,heroBackground:'image',heroImage:image}).success).toBe(false);
 expect(homeLayoutSchema.safeParse({...layout,cards:[layout.cards[0],layout.cards[0]]}).success).toBe(false);
 expect(homeLayoutSchema.safeParse({...layout,heroBackground:'image'}).success).toBe(false);
 expect(homeLayoutSchema.safeParse({...layout,cards:Array.from({length:17},(_,i)=>newHomeCard('tasks','card-'+i))}).success).toBe(false);
 expect(homeCardImage({...layout.cards[0],background:'solid'})).toBe('none');
});
it('saves menu order, hidden entries and widget options while rejecting stale writes',()=>{
 const layout=defaultHomeLayout();layout.cards.reverse();layout.cards[0].visible=false;layout.cards.push(newHomeCard('laws','law-shortcut'));layout.showTasks=false;
 const saved=writeHomeLayout(layout,0);expect(readHomeLayout()).toEqual(saved);expect(saved.version).toBe(1);expect(()=>writeHomeLayout(defaultHomeLayout(),0)).toThrow(/หน้าต่างอื่น/);expect(readHomeLayout().layout).toEqual(layout);
});
it('prepares a real image as a bounded WebP, strips metadata and does not save it until the layout is saved',async()=>{
 const bytes=await sharp({create:{width:1400,height:900,channels:3,background:'#aabbcc'}}).jpeg().withMetadata().toBuffer();
 const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],'photo.jpg',{type:'image/jpeg'}));const result=await prepareHomeImage(form);expect(result.ok).toBe(true);if(!result.ok)return;
 const image=await sharp(Buffer.from(result.image.split(',')[1],'base64')).metadata();expect(image.format).toBe('webp');expect(image.width).toBeLessThanOrEqual(960);expect(image.height).toBeLessThanOrEqual(640);expect(image.exif).toBeUndefined();expect(readHomeLayout().version).toBe(0);
 const layout=defaultHomeLayout();layout.cards[0]={...layout.cards[0],background:'image',image:result.image};const saved=await saveHomeLayout(layout,0);expect(saved.ok).toBe(true);expect(readHomeLayout().layout.cards[0].image).toBe(result.image);
});
it('rejects disguised SVG, broken images and oversized uploads',async()=>{
 for(const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="3" height="3"/></svg>'),Buffer.from('not an image'),Buffer.alloc(5*1024*1024+1)]){
  const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],'pretend.png',{type:'image/png'}));expect((await prepareHomeImage(form)).ok).toBe(false);
 }
 expect(readHomeLayout().version).toBe(0);
});
it('checks authentication before saving a layout',async()=>{
 vi.mocked(requireUser).mockRejectedValueOnce(Error('กรุณาเข้าสู่ระบบใหม่'));expect((await saveHomeLayout(defaultHomeLayout(),0)).ok).toBe(false);expect(readHomeLayout().version).toBe(0);
});
it('round-trips layout and photos in business backups without exporting credentials',async()=>{
 const image=await sharp({create:{width:10,height:10,channels:3,background:'#aabbcc'}}).webp().toBuffer();
 const layout=defaultHomeLayout();layout.title='โต๊ะงานสวัสดิการ';layout.cards[0].background='image';layout.cards[0].image='data:image/webp;base64,'+image.toString('base64');
 const first=writeHomeLayout(layout,0);setSetting('google:token','test-secret-not-for-backup');const backup=exportWorkspace();expect(backup.counts.home_layout).toBe(1);
 expect(fs.readFileSync(path.join(backup.folder,'home_layout.json'),'utf8')).toContain('data:image/webp;base64,');expect(fs.existsSync(path.join(backup.folder,'settings.json'))).toBe(false);
 const second=writeHomeLayout(defaultHomeLayout(),first.version);const preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');const restored=readHomeLayout();expect(restored.layout).toEqual(layout);expect(restored.version).toBeGreaterThan(second.version);expect(getSetting('google:token')).toBe('test-secret-not-for-backup');expect(()=>writeHomeLayout(defaultHomeLayout(),second.version)).toThrow();
});
