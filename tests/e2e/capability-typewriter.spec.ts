import {test,expect} from '@playwright/test';

for(const reducedMotion of ['reduce','no-preference'] as const){
 test('Home types every capability and loops back with motion '+reducedMotion,async({page})=>{
  await page.emulateMedia({reducedMotion});
  await page.goto('/home');
  await expect(page.getByRole('button',{name:'หยุดข้อความเคลื่อนไหว',exact:true})).toBeVisible();
  const words=['ร่างบันทึกข้อความ','ร่างรายงานการประชุม','จัดการโครงการประจำปี','ติดตามงานและกำหนดส่ง','จัดเก็บเอกสาร'];
  // Observe the rendered text, not timer state, to catch the original frozen UI.
  await page.evaluate(words=>{
   const el=document.querySelector('.capability-live')!;
   const seen:string[]=[];
   const capture=()=>{const text=el.textContent||'';if(words.includes(text)&&seen.at(-1)!==text)seen.push(text);el.setAttribute('data-test-cycle',JSON.stringify(seen))};
   capture();new MutationObserver(capture).observe(el,{childList:true,characterData:true,subtree:true});
  },words);
  await expect.poll(async()=>JSON.parse(await page.locator('.capability-live').getAttribute('data-test-cycle')||'[]'),{timeout:60000,intervals:[250]}).toEqual([...words,words[0]]);
  await page.getByRole('button',{name:'หยุดข้อความเคลื่อนไหว',exact:true}).click();
  const paused=await page.getByTestId('welcome-typed').textContent();
  await page.waitForTimeout(800);
  await expect(page.getByTestId('welcome-typed')).toHaveText(paused||'');
  await page.getByRole('button',{name:'เล่นข้อความเคลื่อนไหว',exact:true}).click();
  await expect.poll(()=>page.getByTestId('welcome-typed').textContent(),{timeout:6000}).not.toBe(paused);
 });
}
