import {z} from 'zod';
export const organizationInputSchema=z.object({
 name:z.string().trim().min(1,'ระบุชื่อส่วนราชการ').max(200),
 department:z.string().trim().max(200),address:z.string().trim().max(1000),
 phone:z.string().trim().max(100),prefix:z.string().trim().max(100),
});
export type OrganizationInput=z.infer<typeof organizationInputSchema>;
export type DirectoryOrganization=OrganizationInput&{id:string;version:number};
export const organizationDirectorySql='id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL';
export const emptyOrganization=():OrganizationInput=>({name:'',department:'',address:'',phone:'',prefix:''});
