import {z} from 'zod';
import {BINDER_IDS, buildBinderManifest} from '../manifest';
import type {ComputedProcurementCase} from '../types';

export const BinderDocIdSchema = z.enum(BINDER_IDS);
export const BinderExportSlotSchema = z.enum([...BINDER_IDS, 'OTHER']);
export const GeneratedDocIdSchema = z.enum(['1', '2', '3', '4.1', '6.1', '6.2', '7', '8', '9', '10', '11.1', '11.2', '11.3', '12', '13']);
export const StageSchema = z.enum(['STAGE_1_PRINCIPLE', 'STAGE_2_ORDER', 'STAGE_3_INSPECTION', 'STAGE_4_DISBURSEMENT']);
export const PdfExportProfileSchema = z.discriminatedUnion('mode', [
  z.object({mode: z.literal('FULL_BINDER')}).strict(),
  z.object({mode: z.literal('BY_STAGE'), stage: StageSchema}).strict(),
  z.object({mode: z.literal('SINGLE_DOC'), docId: BinderExportSlotSchema}).strict(),
]);
export const PdfBinderOptionsSchema = z.object({
  density:z.enum(['normal','compact','tight']).optional(),
  profile: PdfExportProfileSchema,
  duplicateCopies: z.boolean().default(false), includeDividers: z.boolean().default(false),
  includeCoverChecklist: z.boolean().default(false),
  includeExternalFiles: z.boolean().default(true),
  routingStripMode: z.enum(['FIRST_COPY_ONLY', 'ALL_COPIES', 'NONE']).default('FIRST_COPY_ONLY'),
}).strict();
export type PdfExportProfile = z.infer<typeof PdfExportProfileSchema>;
export type PdfBinderOptions = z.input<typeof PdfBinderOptionsSchema>;
export const STAGE_DOCS: Record<z.infer<typeof StageSchema>, readonly string[]> = {
  STAGE_1_PRINCIPLE: ['1', '2', '3', '4.1', '4.2'],
  STAGE_2_ORDER: ['5.1', '5.2', '6.1', '6.2', '7', '8', '9', '10'],
  STAGE_3_INSPECTION: ['11.1', '11.2', '11.3', '11.4', '11.5', '12'],
  STAGE_4_DISBURSEMENT: ['13', '14'],
};
export function selectBinderEntries(c: ComputedProcurementCase, profile: PdfExportProfile) {
  const rows = buildBinderManifest(c);
  return rows.filter(row => profile.mode === 'FULL_BINDER' || (profile.mode === 'SINGLE_DOC' ? row.docId === profile.docId : STAGE_DOCS[profile.stage].includes(row.docId)));
}
