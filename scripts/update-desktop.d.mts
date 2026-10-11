export type UpdateManifest={format:number;release:{version:string;appVersion:string;node:string;platform:string;arch:string};files:{name:string;sha256:string}[]};
export function hash(file:string):string;
export function verifyUpdate(folder:string):UpdateManifest;
export function makeUpdate(root:string,target:string):string;
export function applyUpdate(root:string,source:string):{version:string;backup:string};
export function rollback(root:string):{rescue:string};
