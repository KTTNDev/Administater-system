"use server";
import {requireUser} from '@/lib/auth';
import {z} from 'zod';
import index from '@/lib/budget-reference-index.json';
import type {ReferenceSearch,ReferenceSource} from '@/lib/budget-references';
export async function searchBudgetReferences(query:string,source:string=''):Promise<ReferenceSearch>{
 await requireUser();z.string().max(150).parse(query);z.enum(['','ict','ict-2569','equipment','classification']).parse(source);
 const norm=(s:string)=>s.normalize('NFKC').replace(/[๐-๙]/g,c=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c))).replace(/\s/g,'').toLowerCase();
 const q=norm(query);const items=index.items.filter(r=>!r.archived&&(!source||r.source===source)&&norm(r.title+' '+r.type+' '+r.code).includes(q)).slice(0,25);
 const pages=q?index.pages.filter(r=>(!source||r.source===source)&&norm(r.text).includes(q)).slice(0,25).map(r=>({...r,text:r.text.slice(0,240)})):[];
 return {items:items as ReferenceSearch['items'],pages:pages as {source:ReferenceSource;page:number;text:string}[]};
}
