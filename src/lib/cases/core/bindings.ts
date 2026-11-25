import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db, readDraft, writeDraftBatch} from '../../db';
import type {Draft, SavedDraft} from '../../document';
import {resolveLinkedSummariesForFolder, sqliteCaseRepository} from '../server-context';
import type {CaseFolder, GeneratedDocItem, LinkedModuleSummary} from '../types';
import {mapCaseItemToCoreDraft, syncCaseCoreDraft} from './mapper';

export const CASE_CORE_DRAFTS_SQL = `
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  copies INTEGER NOT NULL,
  source_version INTEGER NOT NULL,
  synced_at TEXT NOT NULL,
  UNIQUE(folder_id, item_id)
`;

export const CaseCoreBindingSchema = z.object({
  id: z.string(),
  folder_id: z.string(),
  item_id: z.string(),
  draft_id: z.string(),
  copies: z.number().int().positive(),
  source_version: z.number().int().nonnegative(),
  synced_at: z.string(),
});

export type CaseCoreBinding = z.infer<typeof CaseCoreBindingSchema>;
export type LinkedCaseCoreDraft = CaseCoreBinding & {
  draft: SavedDraft | null;
  localFileWarning?: string | null;
};

export class CaseCoreSyncConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseCoreSyncConflict';
  }
}

function conn() {
  const c = db();
  c.exec(`CREATE TABLE IF NOT EXISTS case_core_drafts (${CASE_CORE_DRAFTS_SQL})`);
  return c;
}

export function listCaseCoreDraftBindings(folderId: string): LinkedCaseCoreDraft[] {
  const rows = conn()
    .prepare('SELECT * FROM case_core_drafts WHERE folder_id = ?')
    .all(folderId);
  return rows.map(row => {
    const link = CaseCoreBindingSchema.parse(row);
    let draft: SavedDraft | null = null;
    if (db().prepare('SELECT id FROM documents WHERE id = ? AND deleted_at IS NULL').get(link.draft_id)) {
      draft = readDraft(link.draft_id);
    }
    return {...link, draft};
  });
}

export function findBoundCoreDraftForCaseItem(
  folderId: string,
  itemId: string,
): SavedDraft | null {
  const row = conn()
    .prepare('SELECT draft_id FROM case_core_drafts WHERE folder_id = ? AND item_id = ?')
    .get(folderId, itemId) as {draft_id: string} | undefined;
  if (!row) return null;
  const exists = db()
    .prepare('SELECT id FROM documents WHERE id = ? AND deleted_at IS NULL')
    .get(row.draft_id);
  return exists ? readDraft(row.draft_id) : null;
}

/**
 * Resolves the authoritative Core `Draft` for a CaseFolder generated item:
 * - If bound to a live Core `SavedDraft` in `case_core_drafts` (and `preferBound !== false`),
 *   returns the saved Core draft verbatim (preserving user edits, signatures, text boxes, attachments).
 * - Otherwise maps the live CaseFolder item into a Core `Draft` via `mapCaseItemToCoreDraft`.
 */
export function resolveCaseItemCoreDraft(
  folder: CaseFolder,
  item: GeneratedDocItem,
  options: {
    linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
    highlightBlanks?: boolean;
    preferBound?: boolean;
  } = {},
): {draft: Draft; boundDraft: SavedDraft | null} {
  if (options.preferBound !== false) {
    try {
      const bound = findBoundCoreDraftForCaseItem(folder.id, item.id);
      if (bound) {
        return {draft: bound, boundDraft: bound};
      }
    } catch {
      // Fallback to live mapping in unit tests without a DB
    }
  }
  const mapped = mapCaseItemToCoreDraft(folder, item, {
    linkedSummaries: options.linkedSummaries,
    highlightBlanks: options.highlightBlanks,
  });
  return {draft: mapped, boundDraft: null};
}

/**
 * Creates missing Core `SavedDraft` bindings for generated docs in a CaseFolder,
 * or explicitly syncs content fields from CaseFolder into existing Core drafts
 * while preserving Core editor-owned overlays, images, and attachments.
 */
export function bindCaseCoreDrafts(
  folderId: string,
  mode: 'create' | 'sync',
  options: {itemIds?: string[]} = {},
): LinkedCaseCoreDraft[] {
  const record = sqliteCaseRepository.load();
  const folder = record.data.folders.find(f => f.id === folderId);
  if (!folder) throw new Error('ไม่พบแฟ้มงานสารบรรณที่ต้องการเชื่อมร่าง Core');

  const linkedSummaries = resolveLinkedSummariesForFolder(folder);
  const targetItems = folder.items.filter(
    (item): item is GeneratedDocItem =>
      item.kind === 'GENERATED_DOC' &&
      (!options.itemIds || options.itemIds.length === 0 || options.itemIds.includes(item.id)),
  );
  if (!targetItems.length) return listCaseCoreDraftBindings(folderId);

  const existingLinks = listCaseCoreDraftBindings(folderId);
  const byItem = new Map(existingLinks.map(l => [l.item_id, l]));

  for (const item of targetItems) {
    const existing = byItem.get(item.id);
    if (existing && !existing.draft) {
      throw new CaseCoreSyncConflict(
        `ร่างเอกสาร "${item.title}" ที่ผูกไว้อยู่ในถังขยะ กรุณากู้คืนจากถังขยะก่อนสร้างหรืออัปเดต`,
      );
    }
  }

  const work = targetItems.filter(item => mode === 'sync' || !byItem.has(item.id));
  if (!work.length) return existingLinks;

  const writes = work.map(item => {
    const generated = mapCaseItemToCoreDraft(folder, item, {
      linkedSummaries,
      highlightBlanks: false,
    });
    const linked = byItem.get(item.id);
    if (linked?.draft) {
      return {
        input: syncCaseCoreDraft(linked.draft, generated),
        id: linked.draft_id,
        version: linked.draft.version,
      };
    }
    return {input: generated};
  });

  const saved = writeDraftBatch(writes, savedDrafts => {
    const now = new Date().toISOString();
    for (let i = 0; i < work.length; i++) {
      const item = work[i];
      const existing = byItem.get(item.id);
      if (existing) {
        conn()
          .prepare(
            'UPDATE case_core_drafts SET copies = ?, source_version = ?, synced_at = ? WHERE id = ?',
          )
          .run(item.copies, record.version, now, existing.id);
      } else {
        conn()
          .prepare(
            'INSERT INTO case_core_drafts(id, folder_id, item_id, draft_id, copies, source_version, synced_at) VALUES(?,?,?,?,?,?,?)',
          )
          .run(
            randomUUID(),
            folderId,
            item.id,
            savedDrafts[i].id,
            item.copies,
            record.version,
            now,
          );
      }
    }
  });

  const warnings = new Map(saved.map(d => [d.id, d.localFileWarning]));
  return listCaseCoreDraftBindings(folderId).map(link => ({
    ...link,
    localFileWarning: warnings.get(link.draft_id),
  }));
}
