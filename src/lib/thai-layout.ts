// Runs inside the preview/export iframe; saved draft text is never changed.
export function thaiLayoutScript(terms:string[]){
 const safe=JSON.stringify([...new Set(terms.filter(Boolean))].sort((a,b)=>b.length-a.length)).replaceAll('<','\\u003c');
 return String.raw`
const keepTerms=__TERMS__;
const keepPattern=keepTerms.length?new RegExp(keepTerms.map(s=>s.replace(/[.*+?^$()|[\]\\]/g,'\\$&')).join('|'),'gu'):null;
const keepRanges=text=>keepPattern?Array.from(text.matchAll(keepPattern),m=>({start:m.index,end:m.index+m[0].length})):[];
let keepId=0;
for(const block of document.querySelectorAll('#source p,#source td,#source figcaption')){
 if(block.querySelector('p,td,figcaption'))continue;
 for(const match of keepRanges(block.textContent).reverse()){
  const nodes=[],walk=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);while(walk.nextNode())nodes.push(walk.currentNode);
  const point=index=>{for(const node of nodes){if(index<=node.textContent.length)return [node,index];index-=node.textContent.length;}const last=nodes[nodes.length-1];return [last,last.textContent.length];};
  const range=document.createRange(),a=point(match.start),b=point(match.end);range.setStart(a[0],a[1]);range.setEnd(b[0],b[1]);
  const span=document.createElement('span');span.className='thai-keep';span.dataset.keepId=String(++keepId);span.append(range.extractContents());range.insertNode(span);
 }
}
`.replace('__TERMS__',safe);
}
