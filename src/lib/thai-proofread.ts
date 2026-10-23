import 'server-only';
import fs from 'node:fs';import path from 'node:path';
import {commonThaiCorrections,type ThaiTermInput} from './thai-dictionary';
let cached:Set<string>|undefined;
export function thaiLexicon(){return cached ||=new Set(fs.readFileSync(path.join(process.cwd(),'public/dictionaries/words_th.txt'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim().normalize('NFC')).filter(Boolean));}
export type ThaiIssue={word:string;start:number;end:number;suggestions:string[];kind:'suggestion'|'unknown'};
export function analyzeThai(text:string,entries:ThaiTermInput[]){
 const lexicon=thaiLexicon(),accepted=entries.filter(e=>!e.correction).map(e=>e.word),corrections={...commonThaiCorrections,...Object.fromEntries(entries.filter(e=>e.correction).map(e=>[e.word,e.correction]))};
 const issues:ThaiIssue[]=[],seen=new Set<string>(),covered:{start:number;end:number}[]=[];
 for(const word of accepted){let start=text.indexOf(word);while(start!==-1){covered.push({start,end:start+word.length});start=text.indexOf(word,start+Math.max(1,word.length));}}
 for(const [word,replacement] of Object.entries(corrections)){if(issues.length>=80)break;const start=text.indexOf(word);if(start<0||covered.some(r=>start>=r.start&&start+word.length<=r.end))continue;issues.push({word,start,end:start+word.length,suggestions:[replacement],kind:'suggestion'});seen.add(word);}
 // ICU supplies Thai word boundaries. An unknown word is a review candidate, never proof of a spelling error.
 for(const segment of new Intl.Segmenter('th',{granularity:'word'}).segment(text)){
  if(issues.length>=80)break;
  const word=segment.segment,start=segment.index,end=start+word.length;
  if(!segment.isWordLike||!/[ก-๙]/.test(word)||lexicon.has(word.normalize('NFC'))||seen.has(word)||covered.some(r=>start>=r.start&&end<=r.end)||issues.some(r=>start<r.end&&end>r.start))continue;
  if(/^[๐-๙\d.,/()-]+$/.test(word))continue;
  issues.push({word,start,end,suggestions:[],kind:'unknown'});seen.add(word);
  if(issues.length>=80)break;
 }
 return {issues:issues.sort((a,b)=>a.start-b.start),dictionarySize:lexicon.size,truncated:issues.length>=80};
}
