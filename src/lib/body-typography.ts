/** Inline authoring markers are parsed before escaping; arbitrary HTML is always escaped. */
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const SOFT_BREAK='\u2028';
export function inlineBody(text:string,encode:(s:string)=>string=escape):string {
 const stack:{open:string;spacing:number;html:string}[]=[{open:'',spacing:0,html:''}];
 const plain=(s:string)=>encode(s).replaceAll(SOFT_BREAK,'<br data-soft-break="true">');
 const pattern=/\[space=(-?\d+(?:\.\d+)?)\]|\[\/space\]|\*\*/g;let from=0;
 for(const match of text.matchAll(pattern)){
  stack.at(-1)!.html+=plain(text.slice(from,match.index));
  if(match[0]==='**'){if(stack.at(-1)!.open==='**'){const part=stack.pop()!;stack.at(-1)!.html+='<strong>'+part.html+'</strong>';}else if(stack.length<30)stack.push({open:'**',spacing:0,html:''});else stack.at(-1)!.html+=encode(match[0]);}
  else if(match[1]!==undefined&&stack.length<30)stack.push({open:match[0],spacing:Number(match[1]),html:''});
  else if(match[0]==='[/space]'&&stack.length>1){const part=stack.pop()!;stack.at(-1)!.html+=part.spacing>=-1&&part.spacing<=3?'<span data-tracking="'+part.spacing+'" style="letter-spacing:'+part.spacing+'pt">'+part.html+'</span>':encode(part.open)+part.html+encode(match[0]);}
  else stack.at(-1)!.html+=encode(match[0]);
  from=match.index!+match[0].length;
 }
 stack.at(-1)!.html+=plain(text.slice(from));while(stack.length>1){const part=stack.pop()!;stack.at(-1)!.html+=encode(part.open)+part.html;}return stack[0].html;

}
export function bodyEditorHtml(value:string):string {
 return value.split('\n').map(line=>line.startsWith('## ')?'<h3>'+inlineBody(line.slice(3))+'</h3>':'<p>'+ (inlineBody(line)||'<br data-empty="true">')+'</p>').join('');
}
export function serializeBodyEditor(root:HTMLElement):string {
 function walk(node:Node):string {
  if(node.nodeType===3)return (node.textContent||'').replace(/\r\n?|\n/g,SOFT_BREAK);
  if(!(node instanceof HTMLElement))return '';
  if(node.tagName==='BR'){if(node.dataset.empty)return '';if(!node.hasAttribute('data-soft-break')&&node===node.parentNode?.lastChild&&node.previousSibling instanceof HTMLBRElement)return '';return SOFT_BREAK;}
  let text=Array.from(node.childNodes).map(walk).join('');
  if(node.matches('strong,b'))text='**'+text+'**';
  const tracking=node.dataset.tracking??(node.style.letterSpacing?String(parseFloat(node.style.letterSpacing)*(node.style.letterSpacing.endsWith('px')?.75:1)):undefined);
  if(tracking!==undefined&&Number(tracking)>=-1&&Number(tracking)<=3)text=`[space=${Number(tracking)}]${text}[/space]`;
  return text;
 }
 const blocks:string[]=[];let inline='';for(const node of Array.from(root.childNodes)){if(node instanceof HTMLElement&&node.matches('p,div,h1,h2,h3,h4')){if(inline){blocks.push(inline);inline='';}blocks.push((node.matches('h1,h2,h3,h4')?'## ':'')+walk(node));}else inline+=walk(node);}if(inline)blocks.push(inline);return blocks.join('\n');
}
