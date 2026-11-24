/** Keep failed saves in the form; never retry a write automatically. */
export const CONNECTION_MESSAGE='ติดต่อระบบสารบรรณไม่ได้ กรุณาตรวจว่าโปรแกรมยังเปิดอยู่ แล้วลองอีกครั้ง ข้อมูลที่กรอกยังอยู่ในหน้านี้';
export async function procurementFetch(url:string,init:RequestInit={},timeoutMs=60000):Promise<Response>{
  const controller=new AbortController(),external=init.signal;
  const abort=()=>controller.abort(external?.reason);
  if(external?.aborted)abort();else external?.addEventListener('abort',abort,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal});}
  catch(e){
    if(external?.aborted)throw e;
    if(timedOut)throw Error('ระบบตอบช้าเกินกำหนด กรุณาลองอีกครั้ง หากเป็นการบันทึกให้ตรวจข้อมูลล่าสุดก่อนส่งซ้ำ');
    if(e instanceof TypeError)throw Error(CONNECTION_MESSAGE);
    throw e;
  }finally{clearTimeout(timer);external?.removeEventListener('abort',abort);}
}
export async function procurementJson<T>(url:string,init:RequestInit={},fallback='ดำเนินการไม่สำเร็จ',timeoutMs=60000):Promise<T>{
  const response=await procurementFetch(url,init,timeoutMs);
  let data;
  try{data=await response.json();}catch{
    throw Error(response.status===401||response.redirected?'กรุณาเปิดระบบและเข้าสู่ระบบใหม่ โดยเก็บหน้านี้ไว้ก่อนเพื่อไม่ให้ข้อมูลที่ยังไม่บันทึกหาย':`ระบบส่งข้อมูลกลับมาไม่ถูกต้อง (${response.status}) กรุณาลองอีกครั้ง`);
  }
  if(!response.ok)throw Error(data?.error||data?.issues?.map((i:{messageTh?:string;message?:string})=>i.messageTh||i.message).filter(Boolean).join('; ')||fallback);
  return data as T;
}
