import type {SqlReader} from './workspace-files.mjs';
export type DossierEntry={key:string;ownerKind:string;ownerId:string;ownerLabel:string;ownerFingerprint:string;groups:string[];ownerFolder:string;subfolders:string[];name:string;mime:string;relativePath:string;sha256:string;md5:string;bytes:number;status:'pending'|'uploading'|'synced'|'failed';fileId?:string;verifiedAt?:string;error?:string};
export function dossierOwnerSnapshot(db:SqlReader,kind:string,id:string,root?:string):{fingerprint:string;label:string;version:number}|null;
export function buildDossierSyncPlan(db:SqlReader,root:string):{entries:DossierEntry[];skipped:{label:string;reason:string}[]};
