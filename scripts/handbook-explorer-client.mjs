/** Runs in a file:// browser; no network or application data access. */
export function explorerClient(files){
 const $=id=>document.getElementById(id);
 const e=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function show(name){
  const f=files.find(x=>x.file===name)||files[0];
  $('name').textContent=f.file;
  $('meta').textContent=f.code.split('\n').length+' บรรทัด · SHA-256 '+f.sha256;
  $('code').innerHTML=f.code.replaceAll('\r','').split('\n').map((s,i)=>'<div class="line"><span class="ln">'+(i+1)+'</span><span class="txt">'+e(s||' ')+'</span></div>').join('');
  $('imports').replaceChildren();
  for(const d of f.imports){if(!d.file)continue;const b=document.createElement('button');b.textContent=d.target;b.onclick=()=>show(d.file);$('imports').appendChild(b);}
  history.replaceState(null,'','#'+encodeURIComponent(f.file));document.querySelector('article').scrollTop=0;
 }
 function list(){
  const q=$('q').value.toLowerCase();$('list').replaceChildren();
  for(const f of files.filter(f=>!q||f.file.toLowerCase().includes(q)||f.code.toLowerCase().includes(q))){const b=document.createElement('button');b.textContent=f.file;b.onclick=()=>show(f.file);$('list').appendChild(b);}
 }
 $('q').oninput=list;list();show(decodeURIComponent(location.hash.slice(1))||'src/app/page.tsx');
}
