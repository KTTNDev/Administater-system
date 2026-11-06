'use server';
import {mirrorLocalOwner} from '@/lib/local-dossiers';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {listOffice} from '@/lib/office-db';
import {projectFiles,readProject,saveProjectProfile,seedProjectChecklist,addProjectFile,updateProjectFile,removeProjectFile} from '@/lib/project-db';
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'บันทึกไม่สำเร็จ';
export async function loadProjectFiles(id:string){await requireUser();return projectFiles(id);}
export async function projectAction(input:unknown){try{await requireUser();const c=z.discriminatedUnion('type',[
 z.object({type:z.literal('profile'),id:z.string().uuid(),version:z.number().int().positive(),value:z.unknown()}),
 z.object({type:z.literal('checklist'),id:z.string().uuid(),version:z.number().int().positive()}),
 z.object({type:z.literal('file'),id:z.string().uuid(),caption:z.string().max(2000),include:z.boolean()}),
 z.object({type:z.literal('remove-file'),id:z.string().uuid()})]).parse(input);
 let projectId=c.id;
 if(c.type==='profile')saveProjectProfile(c.id,c.version,c.value);
 if(c.type==='checklist')seedProjectChecklist(c.id,c.version);
 if(c.type==='file')projectId=updateProjectFile(c.id,c.caption,c.include);
 if(c.type==='remove-file')projectId=removeProjectFile(c.id);
 mirrorLocalOwner('project',projectId);return {ok:true as const,items:listOffice(),files:projectFiles(projectId)};
 }catch(e){return {ok:false as const,error:message(e)}}}
export async function uploadProjectEvidence(form:FormData){try{await requireUser();const id=z.string().uuid().parse(form.get('projectId'));readProject(id,true);await addProjectFile(form);mirrorLocalOwner('project',id);return {ok:true as const,files:projectFiles(id)};}catch(e){return {ok:false as const,error:message(e)}}}
