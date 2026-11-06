import type {DossierEntry} from './dossier-sync-plan.mjs';
export function uploadDossierEntry(drive:any,store:{get(key:string):string|undefined;set(key:string,value:string):void},ns:string,root:string,entry:DossierEntry,bytes:Uint8Array,cache?:Map<string,string>):Promise<{fileId:string;verifiedAt:string}>;
