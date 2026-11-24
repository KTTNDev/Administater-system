import type {RegistryEntry, StoredCase, WorkspaceMaster} from '../workspace/model';
import {procurementJson} from './client-request';
export interface MasterRecord {data:WorkspaceMaster;version:number}
export interface ProcurementRepository {
  listCases():Promise<StoredCase[]>;
  getCase(id:string):Promise<StoredCase|null>;
  saveCase(record:StoredCase):Promise<StoredCase>;
  deleteCase(id:string,version:number):Promise<void>;
  getMasterData():Promise<MasterRecord>;
  saveMasterData(record:MasterRecord):Promise<MasterRecord>;
  getNumberingRegistry():Promise<RegistryEntry[]>;
  advanceNumberingRegistry(input:StoredCase['caseInput']):Promise<RegistryEntry[]>;
}
async function request<T>(action:string,payload?:unknown):Promise<T>{
  return procurementJson<T>('/api/procurement/workspace'+(payload===undefined?'?action='+action:''),{method:payload===undefined?'GET':'POST',headers:payload===undefined?{}:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify({action,payload}),cache:'no-store'},'บันทึกไม่สำเร็จ');
}
/** Uses the existing SQLite workspace and its backup/Drive pipeline, not browser-only data. */
export const procurementRepository:ProcurementRepository={
  listCases:()=>request('list'),getCase:async id=>(await request<StoredCase[]>('list')).find(c=>c.caseInput.id===id)??null,
  saveCase:record=>request('save',record),deleteCase:(id,version)=>request('delete',{id,version}),
  getMasterData:()=>request('master'),saveMasterData:record=>request('saveMaster',record),
  getNumberingRegistry:()=>request('registry'),advanceNumberingRegistry:input=>request('advance',input),
};
