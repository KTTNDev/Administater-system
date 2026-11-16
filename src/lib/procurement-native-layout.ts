/** The exported PDF is authoritative about printed pages. Word can count a
 * virtual trailing page and GoTo can wrap around it. For a single printed
 * page, use the main story directly rather than those unstable page ranges. */
export function printedPageTexts(layout:{pageTexts?:unknown;mainText?:unknown},pages:number):string[]{
 if(pages===1&&typeof layout.mainText==='string')return [layout.mainText.slice(0,1000)];
 const raw=layout.pageTexts;
 if(!Array.isArray(raw)||!raw.every(text=>typeof text==='string'))throw Error('ข้อมูลข้อความหน้าจาก Word ไม่ถูกต้อง');
 let texts:string[]=raw;
 if(texts.length>pages){const printed=texts.filter(text=>text.replace(/[\s\x00-\x1f]/g,''));if(printed.length===pages)texts=printed;}
 if(pages===1&&texts.length>1&&texts.every(text=>text===texts[0]))texts=[texts[0]];
 if(texts.length!==pages)throw Error('ข้อมูลการแบ่งหน้าจาก Word ไม่ครบ: Word '+texts.length+' หน้า / PDF '+pages+' หน้า');
 return texts;
}
