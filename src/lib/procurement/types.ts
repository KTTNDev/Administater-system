import type { z } from 'zod';
import type { AgencyConfigSchema, PersonSchema, SignatoryChainSchema, VendorSchema, BudgetLineSchema, LineItemSchema, InspectorMemberSchema, DocumentNumberAndDateSchema, MasterDataSchema, ProcurementCaseInputSchema } from './schema';
export type AgencyConfig = z.infer<typeof AgencyConfigSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type SignatoryChain = z.infer<typeof SignatoryChainSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type BudgetLine = z.infer<typeof BudgetLineSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type InspectorMember = z.infer<typeof InspectorMemberSchema>;
export type DocRegistry = z.infer<typeof DocumentNumberAndDateSchema>;
export type MasterData = z.infer<typeof MasterDataSchema>;
export type ProcurementCaseInput = z.infer<typeof ProcurementCaseInputSchema>;
export type ProcurementType = ProcurementCaseInput['procurementType'];
export type WorkflowMode = 'MANUAL_UNDER_5000' | 'EGP_OVER_5000';
export interface ValidationIssue {
    code: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    docIds: string[];
    field?: string;
    messageTh: string;
    suggestedFix?: string;
}
export type ComputedProcurementCase = ReturnType<typeof import('./calculations').computeProcurementCase>;
