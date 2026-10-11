"use server";
import {requireUser} from '@/lib/auth';
import {storeRecovery,listRecovery,readRecovery,removeRecovery,pruneRecovery,type RecoveryScope} from '@/lib/recovery';
export async function saveRecovery(input:unknown){await requireUser();return storeRecovery(input);}
export async function getRecoveryList(scope:RecoveryScope){await requireUser();return listRecovery(scope);}
export async function getRecovery(id:string,scope:RecoveryScope){await requireUser();return readRecovery(id,scope);}

export async function deleteRecovery(id:string,scope:RecoveryScope,updatedAt:string,sequence:number){await requireUser();removeRecovery(id,scope,updatedAt,sequence);}
export async function deleteOldRecoveries(scope:RecoveryScope){await requireUser();return pruneRecovery(scope);}
