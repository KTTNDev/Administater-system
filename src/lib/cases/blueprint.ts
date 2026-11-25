import type {AgencyConfig, SignatoryChain} from '../procurement/types';
import {CaseBlueprintSchema, CaseFolderSchema} from './schema';
import type {CaseBlueprint, CaseFolder, CaseItem} from './types';

function scrubItemForReuse(item: CaseItem): CaseItem {
  if (item.kind === 'GENERATED_DOC') {
    const nextPayload = structuredClone(item.payload);
    if (nextPayload.docType === 'ANNOUNCEMENT') {
      nextPayload.registryLogNo = '';
    }
    if (nextPayload.docType === 'MUNICIPAL_ORDER') {
      delete nextPayload.orderYearBE;
    }
    if (nextPayload.docType === 'CERTIFICATE_OR_INVITATION') {
      nextPayload.certificateNo = '';
    }
    if (nextPayload.docType === 'PHOTO_SHEET') {
      nextPayload.photos = [];
    }
    return {
      ...structuredClone(item),
      runningNo: '',
      date: '',
      payload: nextPayload,
      externalOverride: undefined,
    };
  }

  if (item.kind === 'EXTERNAL_FILE_SLOT') {
    return {
      ...structuredClone(item),
      externalDocNo: '',
      externalDate: '',
      uploadedFilePath: undefined,
      uploadedFileName: undefined,
      uploadedFileType: undefined,
      exportBehavior: 'PRINT_DIVIDER_CHECKLIST',
    };
  }

  // LINKED_MODULE_REF: retain structure as placeholder slot pointing to a new link
  return {
    ...structuredClone(item),
    targetId: 'PENDING_LINK',
  };
}

/**
 * Saves a finished CaseFolder as a reusable CaseBlueprint with all old running numbers,
 * dates, uploaded external files, external overrides, and photos wiped clean.
 */
export function saveAsBlueprint(
  folder: CaseFolder,
  options: {name?: string; description?: string; clearVariableValues?: boolean} = {},
): CaseBlueprint {
  const now = new Date().toISOString();
  const clearVars = options.clearVariableValues ?? true;
  const blueprint: CaseBlueprint = {
    id: globalThis.crypto.randomUUID(),
    name: (options.name?.trim() || `${folder.name} (แม่แบบ)`).slice(0, 240),
    category: folder.category,
    description: options.description ?? folder.description,
    variables: folder.variables.map(v => ({
      ...structuredClone(v),
      value: clearVars ? '' : v.value,
    })),
    stages: structuredClone(folder.stages),
    items: folder.items.map(scrubItemForReuse),
    createdAt: now,
    updatedAt: now,
  };
  return CaseBlueprintSchema.parse(blueprint);
}

/**
 * Safely clones an existing CaseFolder for a new job/fiscal year:
 * - Generates a fresh folder ID and timestamps
 * - Wipes all running numbers, document dates, announcement log numbers, photos,
 *   uploaded external files, and external Word/PDF overrides
 * - Preserves folder structure, stages, cross-reference `{{ref:...}}` item IDs,
 *   and shared variable definitions so every citation stays wired cleanly!
 */
export function cloneCaseFolderSafely(
  source: CaseFolder,
  options: {
    name?: string;
    fiscalYearBE?: number;
    clearVariableValues?: boolean;
  } = {},
): CaseFolder {
  const now = new Date().toISOString();
  const clearVars = options.clearVariableValues ?? false;
  const cloned: CaseFolder = {
    ...structuredClone(source),
    id: globalThis.crypto.randomUUID(),
    name: (options.name?.trim() || `${source.name} (สำเนา)`).slice(0, 240),
    fiscalYearBE: options.fiscalYearBE ?? source.fiscalYearBE,
    status: 'DRAFT',
    variables: source.variables.map(v => ({
      ...structuredClone(v),
      value: clearVars ? '' : v.value,
    })),
    items: source.items.map(scrubItemForReuse),
    createdAt: now,
    updatedAt: now,
  };
  return CaseFolderSchema.parse(cloned);
}

/**
 * Instantiates a fresh CaseFolder from a saved CaseBlueprint using the agency's latest
 * AgencyConfig and SignatoryChain.
 */
export function instantiateCaseFolderFromBlueprint(
  blueprint: CaseBlueprint,
  agency: AgencyConfig,
  signatories: SignatoryChain,
  options: {name?: string; fiscalYearBE?: number} = {},
): CaseFolder {
  const now = new Date().toISOString();
  const defaultFy = new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  const folder: CaseFolder = {
    id: globalThis.crypto.randomUUID(),
    name: (options.name?.trim() || blueprint.name.replace(/\s*\(แม่แบบ\)\s*$/, '')).slice(0, 240),
    fiscalYearBE: options.fiscalYearBE ?? defaultFy,
    category: blueprint.category,
    status: 'DRAFT',
    description: blueprint.description,
    agency: structuredClone(agency),
    signatories: structuredClone(signatories),
    variables: structuredClone(blueprint.variables),
    stages: structuredClone(blueprint.stages),
    items: blueprint.items.map(scrubItemForReuse),
    blueprintSourceId: blueprint.id,
    createdAt: now,
    updatedAt: now,
  };
  return CaseFolderSchema.parse(folder);
}
