import {z} from 'zod';
import {CORE_DOC_IDS} from './document-ids';
export const coreOutputFields={caseId:z.string().min(1).max(200),caseVersion:z.number().int().positive().optional(),expectedVersions:z.partialRecord(z.enum(CORE_DOC_IDS),z.number().int().positive()).optional(),allowExportWithErrors:z.boolean().default(false)};
