// Runs inside the sandboxed A4 preview. Editing controls never enter printed output.
export const previewOverlayScript = String.raw`
  let selectedOverlay=null,placingOverlay=null;
  const itemId=node=>node.dataset.overlayId||node.dataset.appendixId||'';
  const overlayNodes=()=>Array.from(root.querySelectorAll('.floating-item'));
  const appendixGridNodes=()=>Array.from(root.querySelectorAll('.appendix-draggable'));
  const allInteractiveNodes=()=>Array.from(root.querySelectorAll('.floating-item,.appendix-draggable'));
  const selectOverlay=id=>{selectedOverlay=id;allInteractiveNodes().forEach(node=>node.classList.toggle('overlay-selected',itemId(node)===id))};
  const setPlacement=id=>{placingOverlay=id;document.body.classList.toggle('placing-overlay',!!id)};
  const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));
  const pageAt=(clientX,clientY,fallback)=>{
    const hits=document.elementsFromPoint?document.elementsFromPoint(clientX,clientY):[];
    const hit=hits.map(el=>el.closest&&el.closest('.page')).find(Boolean);
    return hit&&!!hit.dataset.copyCounterpart===!!fallback.dataset.copyCounterpart?hit:fallback;
  };
  const setPosition=(node,x,y)=>{const page=node.closest('.page'),scale=210/page.getBoundingClientRect().width,box=node.getBoundingClientRect();node.style.left=clamp(x,0,Math.min(195,210-box.width*scale)).toFixed(1)+'mm';node.style.top=clamp(y,0,Math.min(285,297-box.height*scale)).toFixed(1)+'mm'};
  const setWidth=(node,width)=>{const page=node.closest('.page'),scale=210/page.getBoundingClientRect().width,box=node.getBoundingClientRect(),ratio=box.height/Math.max(1,box.width),minW=node.dataset.appendixId?20:10,maxW=node.dataset.appendixId?195:180;node.style.width=clamp(width,minW,Math.min(maxW,210-parseFloat(node.style.left),(297-parseFloat(node.style.top))/Math.max(0.1,ratio))).toFixed(1)+'mm'};
  const geometry=node=>({
    source:node.dataset.appendixId?'sarabun-appendix-position':'sarabun-overlay-position',
    id:itemId(node),
    page:Number(node.closest('.page').dataset.overlayPage),
    xMm:parseFloat(node.style.left),
    yMm:parseFloat(node.style.top),
    widthMm:parseFloat(node.style.width),
    ...(node.dataset.appendixId?{free:true}:{}),
  });
  const emitGeometry=node=>parent.postMessage(geometry(node),'*');
  const detachGridFigure=(node,targetPage)=>{
    const curPage=targetPage||node.closest('.page'),pageBox=curPage.getBoundingClientRect(),scale=210/pageBox.width;
    const img=node.querySelector('img'),imgBox=(img||node).getBoundingClientRect();
    const xMm=clamp((imgBox.left-pageBox.left)*scale,0,195),yMm=clamp((imgBox.top-pageBox.top)*scale,0,285),widthMm=clamp(imgBox.width*scale,20,195);
    const wrap=node.querySelector('.appendix-img-wrap'),frame=node.querySelector('.procurement-photo-frame');
    if(wrap&&img){
      const handle=wrap.querySelector('.overlay-resize');
      node.insertBefore(img,node.firstChild);
      if(handle)node.append(handle);
      wrap.remove();
    }
    if(frame&&!frame.querySelector('img'))frame.remove();
    node.classList.remove('appendix-draggable','appendix-figure','landscape','portrait');
    node.classList.add('floating-item','floating-appendix','overlay-selected');
    node.style.left=xMm.toFixed(1)+'mm';
    node.style.top=yMm.toFixed(1)+'mm';
    node.style.width=widthMm.toFixed(1)+'mm';
    curPage.append(node);
    return {xMm,yMm,widthMm};
  };
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
    if(event.data?.source==='sarabun-appendix-sync'&&Array.isArray(event.data.items)){
      for(const item of event.data.items){
        if(!Number.isFinite(item.widthMm))continue;
        for(const node of allInteractiveNodes().filter(n=>n.dataset.appendixId===item.id)){
          if(Number.isFinite(item.xMm)&&Number.isFinite(item.yMm)&&Number.isFinite(item.page)&&node.classList.contains('floating-appendix')){
            const copy=!!node.closest('.page').dataset.copyCounterpart,target=Array.from(root.children).find(page=>Number(page.dataset.overlayPage)===item.page&&!!page.dataset.copyCounterpart===copy);
            if(!target)continue;target.append(node);node.style.width=item.widthMm+'mm';setPosition(node,item.xMm,item.yMm);
          }else if(node.classList.contains('appendix-draggable')){
            const wrap=node.querySelector('.appendix-img-wrap');if(wrap)wrap.style.width=item.widthMm+'mm';
            node.dataset.appendixWidth=String(item.widthMm);
          }
        }
      }return;
    }
    if(event.data?.source!=='sarabun-overlay-tool')return;
    const id=event.data.id,exists=allInteractiveNodes().some(node=>itemId(node)===id);
    selectOverlay(exists?id:null);setPlacement(exists&&event.data.placing?id:null);
  });
  const cancelPlacement=()=>{setPlacement(null);parent.postMessage({source:'sarabun-overlay-cancel'},'*')};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelPlacement();selectOverlay(null)}});
  root.addEventListener('pointerdown',event=>{
    if(!placingOverlay||event.button!==0)return;
    const page=event.target.closest('.page');
    const node=page&&allInteractiveNodes().find(node=>itemId(node)===placingOverlay&&!!node.closest('.page').dataset.copyCounterpart===!!page.dataset.copyCounterpart);
    if(!page||!node)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(node.classList.contains('appendix-draggable'))detachGridFigure(node,page);
    else page.append(node);
    const box=page.getBoundingClientRect(),scale=210/box.width,imageBox=node.getBoundingClientRect();
    setPosition(node,(event.clientX-box.left-imageBox.width/2)*scale,(event.clientY-box.top-imageBox.height/2)*scale);
    setPlacement(null);node.focus({preventScroll:true});emitGeometry(node);
  },true);

  const wireFloating=node=>{
    if(node.dataset.wiredFloating)return;
    node.dataset.wiredFloating='1';
    node.tabIndex=0;
    if(node.querySelector('img')&&!node.querySelector('.overlay-resize')){
      const handle=document.createElement('button');handle.type='button';handle.className='overlay-resize';handle.setAttribute('aria-label','ลากเพื่อปรับขนาดภาพ');handle.title='ลากเพื่อปรับขนาดภาพ';node.append(handle);
    }
    node.addEventListener('focus',()=>selectOverlay(itemId(node)));
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||placingOverlay)return;
      event.preventDefault();node.focus({preventScroll:true});selectOverlay(itemId(node));
      parent.postMessage({source:'sarabun-overlay-select',id:itemId(node)},'*');
      const resizing=event.target.classList.contains('overlay-resize');
      let curPage=node.closest('.page');
      const startX=event.clientX,startY=event.clientY,initialX=parseFloat(node.style.left),initialY=parseFloat(node.style.top),initialWidth=parseFloat(node.style.width);
      const startPageBox=curPage.getBoundingClientRect(),scale=210/startPageBox.width,ratio=node.getBoundingClientRect().height/Math.max(1,node.getBoundingClientRect().width);
      const offsetInNodeX=(startX-node.getBoundingClientRect().left)*scale,offsetInNodeY=(startY-node.getBoundingClientRect().top)*scale;
      node.setPointerCapture(event.pointerId);
      const move=e=>{
        if(resizing){
          const dx=(e.clientX-startX)*scale,dy=(e.clientY-startY)*scale;
          setWidth(node,initialWidth+(dx+dy*ratio)/(1+ratio*ratio));
          return;
        }
        const hitPage=pageAt(e.clientX,e.clientY,curPage);
        if(hitPage!==curPage){curPage=hitPage;curPage.append(node);}
        const pBox=curPage.getBoundingClientRect(),pScale=210/pBox.width;
        if(curPage===node.closest('.page')&&pBox===startPageBox){
          setPosition(node,initialX+(e.clientX-startX)*scale,initialY+(e.clientY-startY)*scale);
        }else{
          setPosition(node,(e.clientX-pBox.left)*pScale-offsetInNodeX,(e.clientY-pBox.top)*pScale-offsetInNodeY);
        }
      };
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
  };

  overlayNodes().forEach(wireFloating);

  appendixGridNodes().forEach(node=>{
    node.tabIndex=0;
    const wrap=node.querySelector('.appendix-img-wrap');
    if(wrap&&!wrap.querySelector('.overlay-resize')){
      const handle=document.createElement('button');handle.type='button';handle.className='overlay-resize';handle.setAttribute('aria-label','ลากเพื่อปรับขนาดภาพ');handle.title='ลากเพื่อปรับขนาดภาพ';wrap.append(handle);
    }
    node.addEventListener('focus',()=>selectOverlay(itemId(node)));
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||placingOverlay||!node.classList.contains('appendix-draggable'))return;
      event.preventDefault();node.focus({preventScroll:true});selectOverlay(itemId(node));
      parent.postMessage({source:'sarabun-overlay-select',id:itemId(node)},'*');
      const resizing=event.target.classList.contains('overlay-resize');
      let curPage=node.closest('.page');
      const startX=event.clientX,startY=event.clientY,pageBox=curPage.getBoundingClientRect(),scale=210/pageBox.width;
      const imgWrap=node.querySelector('.appendix-img-wrap')||node,img=node.querySelector('img');
      const startRect=(img||imgWrap).getBoundingClientRect(),ratio=startRect.height/Math.max(1,startRect.width);
      const initialWidth=parseFloat(node.dataset.appendixWidth)||startRect.width*scale;
      let detached=false,offsetInNodeX=0,offsetInNodeY=0,currentWidth=initialWidth;
      node.setPointerCapture(event.pointerId);
      const move=e=>{
        const dx=(e.clientX-startX)*scale,dy=(e.clientY-startY)*scale;
        if(resizing){
          currentWidth=clamp(initialWidth+(dx+dy*ratio)/(1+ratio*ratio),20,195);
          if(imgWrap&&imgWrap.style)imgWrap.style.width=currentWidth.toFixed(1)+'mm';
          node.dataset.appendixWidth=currentWidth.toFixed(1);
          return;
        }
        if(!detached&&Math.hypot(e.clientX-startX,e.clientY-startY)<4)return;
        if(!detached){
          detached=true;
          detachGridFigure(node,curPage);
          const nBox=node.getBoundingClientRect();
          offsetInNodeX=(startX-nBox.left)*scale;
          offsetInNodeY=(startY-nBox.top)*scale;
        }
        const hitPage=pageAt(e.clientX,e.clientY,curPage);
        if(hitPage!==curPage){curPage=hitPage;curPage.append(node);}
        const pBox=curPage.getBoundingClientRect(),pScale=210/pBox.width;
        setPosition(node,(e.clientX-pBox.left)*pScale-offsetInNodeX,(e.clientY-pBox.top)*pScale-offsetInNodeY);
      };
      const cleanup=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',cancel);if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId)};
      const end=e=>{
        move(e);cleanup();
        if(resizing){
          parent.postMessage({source:'sarabun-appendix-position',id:itemId(node),widthMm:Math.round(currentWidth*10)/10,free:false},'*');
        }else if(detached){
          wireFloating(node);
          emitGeometry(node);
        }
      };
      const cancel=()=>{
        if(resizing&&imgWrap&&imgWrap.style){imgWrap.style.width=initialWidth+'mm';node.dataset.appendixWidth=String(initialWidth);}
        cleanup();
      };
      node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',cancel);
    });
  });
`;
