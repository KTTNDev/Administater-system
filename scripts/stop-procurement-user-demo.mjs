import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const folder=path.resolve('output/procurement-user-demo'),base='http://127.0.0.1:3110';
assert.equal(fs.readFileSync(path.join(folder,'SAFETY-TEST-ONLY'),'utf8').trim(),'SARABUN_PROCUREMENT_USER_DEMO_V1','Demo marker mismatch');
const stateFile=path.join(folder,'server.json'),state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
const health=async()=>{
 try{
  const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});
  assert(response.ok,'Unexpected server on demo port');return await response.json();
 }catch(error){if(error.cause?.code==='ECONNREFUSED')return null;throw error;}
};
const current=await health();
if(current){
 assert.equal(current.application,'sarabun');assert.equal(current.instance,'procurement-user-demo');assert.equal(current.pid,state.pid,'Demo PID mismatch');
 assert(Number.isInteger(state.pid)&&state.pid>0,'Invalid demo PID');
 process.kill(state.pid);
 for(let i=0;i<30;i++){
  try{if(!await health())break;}
  catch(error){if(!['ECONNRESET','UND_ERR_SOCKET'].includes(error.cause?.code))throw error;}
  await delay(300);
 }
 assert.equal(await health(),null,'Demo did not stop');
}
fs.writeFileSync(stateFile,JSON.stringify({...state,stoppedAt:new Date().toISOString()},null,2));
console.log('Demo on port 3110 stopped. Its data is preserved. The real system on port 3000 is unchanged.');
