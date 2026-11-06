export type MoveInput={sourceRoot:string;database:string;localFolder:string;target:string;configurationHash?:string};
export type MovePlan={database:string;localFolder:string;target:string;files:number;bytes:number;freeBytes:number;configurationHash:string};
export function planDataMove(input:MoveInput):MovePlan;
export function migrateDataLocation(input:MoveInput):{database:string;localFolder:string;checkpoint:string;files:number;dossiers:number;warning:string};
