// Runs inside the sandboxed A4 preview. Editing controls never enter printed output.
export const previewOverlayScript = String.raw`
  let selectedOverlay=null,placingOverlay=null;
  const overlayNodes=()=>Array.from(root.querySelectorAll('.floating-item'));
  const selectOverlay=id=>{selectedOverlay=id;overlayNodes().forEach(node=>node.classList.toggle('overlay-selected',node.dataset.overlayId===id))};
  const setPlacement=id=>{placingOverlay=id;document.body.classList.toggle('placing-overlay',!!id)};
  const geometry=node=>({source:'sarabun-overlay-position',id:node.dataset.overlayId,page:Number(node.closest('.page').dataset.overlayPage),xMm:parseFloat(node.style.left),yMm:parseFloat(node.style.top),widthMm:parseFloat(node.style.width)});
  const emitGeometry=node=>parent.postMessage(geometry(node),'*');
  const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));
  const setPosition=(node,x,y)=>{const page=node.closest('.page'),scale=210/page.getBoundingClientRect().width,box=node.getBoundingClientRect();node.style.left=clamp(x,0,Math.min(195,210-box.width*scale)).toFixed(1)+'mm';node.style.top=clamp(y,0,Math.min(285,297-box.height*scale)).toFixed(1)+'mm'};
  const setWidth=(node,width)=>{const page=node.closest('.page'),scale=210/page.getBoundingClientRect().width,box=node.getBoundingClientRect(),ratio=box.height/box.width;node.style.width=clamp(width,10,Math.min(180,210-parseFloat(node.style.left),(297-parseFloat(node.style.top))/ratio)).toFixed(1)+'mm'};
  window.addEventListener('message',event=>{
    if(event.source!==parent)return;
    if(event.data?.source==='sarabun-overlay-sync'&&Array.isArray(event.data.items)){
      for(const item of event.data.items){
        if(![item.page,item.xMm,item.yMm,item.widthMm].every(Number.isFinite))continue;
        for(const node of overlayNodes().filter(node=>node.dataset.overlayId===item.id)){
          const copy=!!node.closest('.page').dataset.copyCounterpart,target=Array.from(root.children).find(page=>Number(page.dataset.overlayPage)===item.page&&!!page.dataset.copyCounterpart===copy);
          if(!target)continue;target.append(node);node.style.width=item.widthMm+'mm';setPosition(node,item.xMm,item.yMm);
        }
      }return;
    }
    if(event.data?.source!=='sarabun-overlay-tool')return;
    const id=event.data.id,exists=overlayNodes().some(node=>node.dataset.overlayId===id);
    selectOverlay(exists?id:null);setPlacement(exists&&event.data.placing?id:null);
  });
  const cancelPlacement=()=>{setPlacement(null);parent.postMessage({source:'sarabun-overlay-cancel'},'*')};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelPlacement();selectOverlay(null)}});
  root.addEventListener('pointerdown',event=>{
    if(!placingOverlay||event.button!==0)return;
    const page=event.target.closest('.page'),node=page&&overlayNodes().find(node=>node.dataset.overlayId===placingOverlay&&!!node.closest('.page').dataset.copyCounterpart===!!page.dataset.copyCounterpart);
    if(!page||!node)return;
    event.preventDefault();event.stopImmediatePropagation();page.append(node);
    const box=page.getBoundingClientRect(),scale=210/box.width,imageBox=node.getBoundingClientRect();
    setPosition(node,(event.clientX-box.left-imageBox.width/2)*scale,(event.clientY-box.top-imageBox.height/2)*scale);
    setPlacement(null);node.focus({preventScroll:true});emitGeometry(node);
  },true);
  overlayNodes().forEach(node=>{
    node.tabIndex=0;
    if(node.querySelector('img')){const handle=document.createElement('button');handle.type='button';handle.className='overlay-resize';handle.setAttribute('aria-label','ลากเพื่อปรับขนาดภาพ');handle.title='ลากเพื่อปรับขนาดภาพ';node.append(handle)}
    node.addEventListener('focus',()=>selectOverlay(node.dataset.overlayId));
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||placingOverlay)return;
      event.preventDefault();node.focus({preventScroll:true});selectOverlay(node.dataset.overlayId);
      parent.postMessage({source:'sarabun-overlay-select',id:node.dataset.overlayId},'*');
      const resizing=event.target.classList.contains('overlay-resize'),page=node.closest('.page'),startX=event.clientX,startY=event.clientY,initialX=parseFloat(node.style.left),initialY=parseFloat(node.style.top),initialWidth=parseFloat(node.style.width),scale=210/page.getBoundingClientRect().width,ratio=node.getBoundingClientRect().height/node.getBoundingClientRect().width;
      node.setPointerCapture(event.pointerId);
      const move=e=>{const dx=(e.clientX-startX)*scale,dy=(e.clientY-startY)*scale;if(resizing)setWidth(node,initialWidth+(dx+dy*ratio)/(1+ratio*ratio));else setPosition(node,initialX+dx,initialY+dy)};
      const cleanup=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',cancel);if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId)};
      const end=e=>{move(e);cleanup();emitGeometry(node)};
      const cancel=()=>{node.style.left=initialX+'mm';node.style.top=initialY+'mm';node.style.width=initialWidth+'mm';cleanup()};
      node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',cancel);
    });
    node.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();const delta=(event.shiftKey?5:1)*(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);
      if(event.target.classList.contains('overlay-resize'))setWidth(node,parseFloat(node.style.width)+delta);
      else setPosition(node,parseFloat(node.style.left)+(['ArrowLeft','ArrowRight'].includes(event.key)?delta:0),parseFloat(node.style.top)+(['ArrowUp','ArrowDown'].includes(event.key)?delta:0));
      emitGeometry(node);
    });
  });
`;
