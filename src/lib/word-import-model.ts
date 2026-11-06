import {z} from 'zod';
// Review fields are deliberately separate from Draft: a file cannot set status, IDs or attachments.
const text=z.string().max(2000).default('');
export const wordImportFieldsSchema=z.object({
 type:z.enum(['internal','memorandum']).default('internal'),
 organization:text,number:text,date:z.string().max(10).default(''),subject:z.string().max(300).default(''),
 confidentiality:z.enum(['ปกติ','ลับ','ลับมาก','ลับที่สุด']).default('ปกติ'),urgency:z.enum(['ปกติ','ด่วน','ด่วนมาก','ด่วนที่สุด']).default('ปกติ'),
 recipient:text,body:z.string().max(40000).default(''),closing:text,signer:text,position:text,
});
export type WordImportFields=z.infer<typeof wordImportFieldsSchema>;
export type WordImportAnalysis={fields:WordImportFields;sourceText:string;warnings:string[];paragraphs:number;tables:number;images:number;sha256:string};
export const WORD_IMPORT_LIMIT=10*1024*1024;
export const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const documentSourcesSql='id TEXT PRIMARY KEY,document_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,file BLOB NOT NULL,sha256 TEXT NOT NULL,analysis TEXT NOT NULL,request_hash TEXT NOT NULL,created_at TEXT NOT NULL';

export const wordImportAnalysisSchema=z.object({fields:wordImportFieldsSchema,sourceText:z.string().max(100000),warnings:z.array(z.string().max(2000)).max(100),paragraphs:z.number().int().nonnegative(),tables:z.number().int().nonnegative(),images:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
