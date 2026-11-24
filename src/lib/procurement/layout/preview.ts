import {paginateDocument,PAGINATION_MEASUREMENT_CSS} from './paginate-document';
import {pageRules} from '../templates/sarabun-rules';
import type {DocumentFamily} from '../templates/ir';
import {toThaiDigits} from '../formatting';
/** Runs inside an isolated, same-origin iframe after its embedded fonts/images have loaded. */
export async function prepareA4Preview(doc:Document,family:DocumentFamily,note:string){
 await doc.fonts.ready;await Promise.all([...doc.images].map(image=>image.decode()));
 const main=doc.querySelector<HTMLElement>('.document');if(!main)throw Error('ไม่พบเนื้อหาเอกสาร');
 const style=doc.createElement('style');style.textContent=PAGINATION_MEASUREMENT_CSS;doc.head.append(style);
 const margins=pageRules(family).marginsCm,usable=(29.7-margins.top-margins.bottom)*96/2.54;
 const measure=()=>{const sheet=main.querySelector<HTMLElement>('.sheet')!;return Math.max(sheet.scrollHeight,sheet.getBoundingClientRect().height);};
 let height=measure();
 if(main.dataset.singlePagePreferred==='true'&&main.children.length===1&&height>usable&&height/usable<=1.16){for(const density of ['compact','tight']){main.dataset.density=density;height=measure();if(height<=usable)break;}}
 if(height>usable&&main.dataset.singlePagePreferred==='true')main.dataset.density='normal';
 const layout=paginateDocument({margins},doc);
 if(layout.horizontalOverflow||layout.overflows.length)throw Error('เนื้อหาล้นกระดาษ กรุณาตรวจรายละเอียดและขนาดรูป');
 for(const [index,page] of [...main.children].entries()){
   const paper=doc.createElement('div');paper.className='pw-physical-preview';const top=(page as HTMLElement).dataset.purpose==='attachment'?2.5:margins.top;
   Object.assign(paper.style,{width:'210mm',height:'297mm',padding:`${top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`,margin:'12px auto',position:'relative',background:'white',boxSizing:'border-box'});
   page.replaceWith(paper);paper.append(page);
   if(index){const number=doc.createElement('div');number.textContent=`- ${toThaiDigits(index+1)} -`;Object.assign(number.style,{position:'absolute',top:'0',left:'0',right:'0',height:`${top}cm`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16pt',lineHeight:'normal'});paper.append(number);const footer=doc.createElement('div');footer.textContent=note;Object.assign(footer.style,{position:'absolute',bottom:'0',height:`${margins.bottom}cm`,display:'flex',alignItems:'center',left:`${margins.left}cm`,right:`${margins.right}cm`,fontSize:'12pt',lineHeight:'normal'});paper.append(footer);}
 }
 return {...layout,density:main.dataset.density};
}
