import {z} from 'zod';
import {CORE_DOC_IDS} from './document-ids';
export const CoreBindingSchema=z.object({
  id:z.string().min(1),case_id:z.string().min(1),doc_id:z.enum(CORE_DOC_IDS),draft_id:z.string().uuid(),
  copies:z.number().int().min(1).max(3),source_version:z.number().int().positive(),synced_at:z.string().datetime(),
});
export type CoreBinding=z.infer<typeof CoreBindingSchema>;
