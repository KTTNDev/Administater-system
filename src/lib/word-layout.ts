// Read the same measured layout used by the preview. Text remains text in DOCX;
// only existing images and uploaded PDF pages are raster images.
export type WordRun = { keepGroup?:string; text: string; bold: boolean; underline: boolean; size: number; color: string };
export type Box = { x: number; y: number; width: number; height: number };
export type WordParagraph = Box & { kind: 'paragraph'; runs: WordRun[]; align: string; indent: number; line: number; tabs: number[]; keep: boolean; border: boolean; outline?: boolean };
export type WordTable = Box & { kind: 'table'; rows: { header: boolean; cells: WordParagraph[] }[] };
export type WordImage = Box & { kind: 'image'; source: string; alt: string; crop?: { left: number; right: number; top: number; bottom: number } };
export type WordPage = { width: number; height: number; top: number; left: number; right: number; copy: boolean; blocks: (WordParagraph | WordTable)[]; overlays: (WordParagraph | WordImage)[] };

// This function runs inside the isolated export browser, not in the editor.
export function extractWordPages(): WordPage[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#pages .page')).map(page => {
    const pageBox = page.getBoundingClientRect(), content = page.querySelector<HTMLElement>('.content')!;
    const contentBox = content.getBoundingClientRect();
    const box = (el: Element): Box => { const b = el.getBoundingClientRect(); return { x: b.left - pageBox.left, y: b.top - pageBox.top, width: b.width, height: b.height }; };
    const visible = (el: Element) => getComputedStyle(el).display !== 'none';
    const runs = (el: Element): WordRun[] => {
      const result: WordRun[] = [];
      const walk = (node: Node) => {
        if (node instanceof Element && (!visible(node)||node.classList.contains('document-dot-guide'))) return;
        if (node.nodeType === Node.TEXT_NODE || node instanceof HTMLBRElement) {
          const parent = node.parentElement!, css = getComputedStyle(parent);
          const rgb = css.color.match(/\d+/g)?.slice(0,3).map(n => Number(n).toString(16).padStart(2,'0')).join('') || '111111';
          result.push({ keepGroup:parent.closest<HTMLElement>('.thai-keep')?.dataset.keepId, text: node instanceof HTMLBRElement ? '\n' : node.textContent || '', bold: Number(css.fontWeight) >= 600, underline: css.textDecorationLine.includes('underline') || getComputedStyle(el).textDecorationLine.includes('underline'), size: parseFloat(css.fontSize) * .75, color: rgb });
        } else node.childNodes.forEach((child,index)=>{
          if(index && node instanceof Element && node.matches('.memo-field')) result.push({text:' ',bold:false,underline:false,size:16,color:'111111'});
          walk(child);
        });
      };
      walk(el); return result;
    };
    const para = (el: Element): WordParagraph => {
      const css = getComputedStyle(el), b = box(el), tabs: number[] = [];
      let text = runs(el);
      if (['flex','grid'].includes(css.display) && el.children.length > 1) {
        text = [];
        Array.from(el.children).filter(visible).forEach((child,i) => {
          if(i) { tabs.push(box(child).x-b.x); text.push({text:'\t',bold:false,underline:false,size:16,color:'111111'}); }
          text.push(...runs(child));
        });
      }
      return { ...b, kind:'paragraph', runs:text, align:css.textAlign, indent:parseFloat(css.textIndent)||0, line:el.classList.contains('opinion-line')?b.height:parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.2, tabs, keep:!!el.closest('.signature,.signoff-group,.opinion-sign') && !!el.nextElementSibling, border:false };
    };
    const result: WordPage = {width:pageBox.width,height:pageBox.height,top:contentBox.top-pageBox.top,left:contentBox.left-pageBox.left,right:pageBox.right-contentBox.right,copy:page.classList.contains('counterpart-page'),blocks:[],overlays:[]};
    const walk = (el: Element, floating = false) => {
      if(!visible(el)) return;
      if(el.classList.contains('garuda')) {
        const img=el.querySelector('img')!;
        result.overlays.push({...box(el),kind:'image',source:img.src,alt:'ตราครุฑ',crop:{left:498/2320*100,right:(2320-498-1194)/2320*100,top:324/1811*100,bottom:(1811-324-1340)/1811*100}}); return;
      }
      if(el instanceof HTMLImageElement) {
        let b=box(el);
        // object-fit:contain can leave empty space inside an image's CSS box.
        const scale=Math.min(b.width/el.naturalWidth,b.height/el.naturalHeight);
        const w=el.naturalWidth*scale,h=el.naturalHeight*scale;
        b={x:b.x+(b.width-w)/2,y:b.y+(b.height-h)/2,width:w,height:h};
        result.overlays.push({...b,kind:'image',source:el.src,alt:el.alt}); return;
      }
      if(el instanceof HTMLTableElement) {
        result.blocks.push({...box(el),kind:'table',rows:Array.from(el.rows).map(row=>({header:!!row.closest('thead'),cells:Array.from(row.cells).map(para)}))}); return;
      }
      if(el.classList.contains('memo-row')) { result.blocks.push(para(el)); return; }
      const special = floating || el.matches('.letter-head,.appendix-sheet,.certificate-photo-area');
      if(el.matches('p,h1,h2,figcaption,.letter-number,.letter-agency,.opinion-line,.certificate-photo') || el.matches('.floating-item,.copy-mark-text,.urgency,.security,.page-number,.continuation-cue,.security-control') && !el.querySelector('img') || el.parentElement?.classList.contains('memo-head') && el.tagName==='STRONG') {
        const p=para(el);
        if(el.classList.contains('certificate-photo')) p.outline=true;
        (special ? result.overlays : result.blocks).push(p); return;
      }
      Array.from(el.children).forEach(child=>walk(child,special));
    };
    Array.from(page.children).forEach(el=>{
      if(el===content) Array.from(el.children).forEach(child=>walk(child));
      else walk(el,true);
    });
    // Decorative field guides are separate editable text overlays in Word.
    // Keep them out of the logical header text and preserve their measured position.
    for(const guide of page.querySelectorAll<HTMLElement>('.document-dot-guide')){
      const b=box(guide);result.overlays.push({...b,kind:'paragraph',runs:[{text:guide.textContent||'',bold:false,underline:false,size:16,color:'111111'}],align:'left',indent:0,line:b.height,tabs:[],keep:false,border:false});
    }
    return result;
  });
}
