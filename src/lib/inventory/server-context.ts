import 'server-only';
import {db} from '../db';
import {defaultAgency} from '../procurement/presets/default-agency';
import {ProcurementCaseInputSchema} from '../procurement/schema';
import {sqliteRepository as procurementRepo} from '../procurement/storage/sqlite';
import type {AgencyConfig, SignatoryChain} from '../procurement/types';
import {cleanForExport} from '../procurement/workspace/model';
import {mapProcurementCaseToStockIntake, type ProcurementIntakeMappingResult} from './procurement-bridge';
import {createSqliteInventoryRepository, type SqliteLike} from './repository';
import type {InventoryDomainState} from './types';
import type {InventoryFormContext} from './templates/build-forms';

export const sqliteInventoryRepository = createSqliteInventoryRepository(
  () => db() as unknown as SqliteLike,
);

export function resolveInventoryContext(): InventoryFormContext {
  try {
    const master = procurementRepo.getMasterData().data;
    const agency: AgencyConfig = master.agency ?? defaultAgency;
    const byId = new Map(master.people.map(p => [p.id, p]));
    const sigs: Partial<SignatoryChain> = {};
    for (const key of ['procurementOfficer', 'divisionDirector', 'municipalClerk', 'mayor'] as const) {
      const person = byId.get(master.signatories[key]);
      if (person && person.fullName.trim()) {
        sigs[key] = person;
      }
    }
    return {agency, signatories: sigs};
  } catch {
    return {agency: defaultAgency};
  }
}

export interface ProcurementIntakeOption {
  caseId: string;
  title: string;
  vendorShopName: string;
  poNumber: string;
  inspectionDate: string;
  fiscalYearBE: number;
  grandTotal: number;
  itemCount: number;
  alreadyImported: boolean;
  mapping: ProcurementIntakeMappingResult;
}

export function listProcurementIntakeOptions(state: InventoryDomainState): ProcurementIntakeOption[] {
  const cases = procurementRepo.listCases();
  const options: ProcurementIntakeOption[] = [];

  for (const record of cases) {
    const parsed = ProcurementCaseInputSchema.safeParse(cleanForExport(record.caseInput));
    if (!parsed.success) continue;
    const input = parsed.data;
    if (input.procurementType !== 'BUY') continue;
    try {
      const mapping = mapProcurementCaseToStockIntake(input, state.materials, state.lots, record.agency);
      const grandTotal = mapping.drafts.reduce((sum, d) => sum + d.lineTotal, 0);
      options.push({
        caseId: input.id,
        title: input.projectTitleShort || input.budgetLine.categoryType,
        vendorShopName: mapping.vendorShopName,
        poNumber: mapping.poNumber,
        inspectionDate: mapping.inspectionDate,
        fiscalYearBE: mapping.fiscalYearBE,
        grandTotal,
        itemCount: mapping.drafts.length,
        alreadyImported: mapping.alreadyImported,
        mapping,
      });
    } catch {
      // Skip incomplete cases that cannot compute totals cleanly yet
    }
  }
  return options;
}
