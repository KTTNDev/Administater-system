import {suggestNextNumber, type NumberTrack} from '../procurement/numbering';
import {CaseDomainStateSchema, CaseFolderSchema, CaseBlueprintSchema} from './schema';
import type {
  CaseBlueprint,
  CaseDomainState,
  CaseFolder,
  SharedRegistryEntry,
} from './types';

export interface CaseDomainRecord {
  data: CaseDomainState;
  version: number;
  updatedAt: string;
}

export class CaseConflictError extends Error {
  constructor() {
    super('ข้อมูลแฟ้มงานสารบรรณถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
    this.name = 'CaseConflictError';
  }
}

export interface CaseRepository {
  load(): CaseDomainRecord;
  save(record: CaseDomainRecord): CaseDomainRecord;
  update(mutator: (current: CaseDomainState) => CaseDomainState): CaseDomainRecord;
  upsertFolder(folder: CaseFolder): CaseDomainRecord;
  deleteFolder(folderId: string): CaseDomainRecord;
  upsertBlueprint(blueprint: CaseBlueprint): CaseDomainRecord;
  deleteBlueprint(blueprintId: string): CaseDomainRecord;
  reserveNextNumber(track: NumberTrack, yearBE: number, sourceId?: string): {runningNo: string; record: CaseDomainRecord};
}

export const CASE_DOMAIN_SQL =
  'id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL';

export function createEmptyCaseDomainState(): CaseDomainState {
  return {
    folders: [],
    blueprints: [],
    sharedRegistry: [],
  };
}

function buildHelpers(base: Pick<CaseRepository, 'load' | 'save' | 'update'>): CaseRepository {
  return {
    ...base,
    upsertFolder(folder) {
      const parsed = CaseFolderSchema.parse(folder);
      return base.update(state => {
        const idx = state.folders.findIndex(f => f.id === parsed.id);
        const folders = [...state.folders];
        if (idx >= 0) folders[idx] = parsed;
        else folders.push(parsed);
        return {...state, folders};
      });
    },
    deleteFolder(folderId) {
      return base.update(state => ({
        ...state,
        folders: state.folders.filter(f => f.id !== folderId),
      }));
    },
    upsertBlueprint(blueprint) {
      const parsed = CaseBlueprintSchema.parse(blueprint);
      return base.update(state => {
        const idx = state.blueprints.findIndex(b => b.id === parsed.id);
        const blueprints = [...state.blueprints];
        if (idx >= 0) blueprints[idx] = parsed;
        else blueprints.push(parsed);
        return {...state, blueprints};
      });
    },
    deleteBlueprint(blueprintId) {
      return base.update(state => ({
        ...state,
        blueprints: state.blueprints.filter(b => b.id !== blueprintId),
      }));
    },
    reserveNextNumber(track, yearBE, sourceId) {
      let runningNo = '1';
      const record = base.update(state => {
        const existing = state.sharedRegistry.map(e => ({
          track: e.track,
          yearBE: e.yearBE,
          runningNo: e.runningNo,
        }));
        runningNo = suggestNextNumber(existing, track, yearBE);
        const entry: SharedRegistryEntry = {
          track,
          yearBE,
          runningNo,
          sourceModule: 'CASE_FOLDER',
          ...(sourceId ? {sourceId} : {}),
        };
        return {
          ...state,
          sharedRegistry: [...state.sharedRegistry, entry],
        };
      });
      return {runningNo, record};
    },
  };
}

export function createMemoryCaseRepository(
  initialState: CaseDomainState = createEmptyCaseDomainState(),
): CaseRepository {
  let stored: CaseDomainRecord = {
    data: CaseDomainStateSchema.parse(structuredClone(initialState)),
    version: 0,
    updatedAt: '',
  };

  return buildHelpers({
    load() {
      return {
        data: CaseDomainStateSchema.parse(structuredClone(stored.data)),
        version: stored.version,
        updatedAt: stored.updatedAt,
      };
    },
    save(record) {
      if (record.version !== stored.version) throw new CaseConflictError();
      const validated = CaseDomainStateSchema.parse(record.data);
      const next: CaseDomainRecord = {
        data: structuredClone(validated),
        version: stored.version + 1,
        updatedAt: new Date().toISOString(),
      };
      stored = next;
      return {
        data: structuredClone(next.data),
        version: next.version,
        updatedAt: next.updatedAt,
      };
    },
    update(mutator) {
      const current = this.load();
      const nextData = mutator(current.data);
      return this.save({...current, data: nextData});
    },
  });
}

export interface CaseSqliteLike {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): {changes: number | bigint};
  };
  transaction<T>(operation: () => T): () => T;
}

/**
 * Optimistic-version SQLite persistence adapter for CaseFolders, Blueprints, and Shared 5-Track Registry.
 * Uses an isolated `case_folder_domain_state` table so existing tables remain untouched.
 */
export function createSqliteCaseRepository(
  getDb: () => CaseSqliteLike,
  scopeId = 'default',
): CaseRepository {
  const ensureTable = () => {
    const conn = getDb();
    conn.exec(`CREATE TABLE IF NOT EXISTS case_folder_domain_state (${CASE_DOMAIN_SQL})`);
    return conn;
  };

  return buildHelpers({
    load() {
      const conn = ensureTable();
      const row = conn
        .prepare('SELECT data, version, updated_at FROM case_folder_domain_state WHERE id=?')
        .get(scopeId);
      if (!row) {
        return {
          data: createEmptyCaseDomainState(),
          version: 0,
          updatedAt: '',
        };
      }
      return {
        data: CaseDomainStateSchema.parse(JSON.parse(String(row.data))),
        version: Number(row.version),
        updatedAt: String(row.updated_at),
      };
    },
    save(record) {
      const validated = CaseDomainStateSchema.parse(record.data);
      const conn = ensureTable();
      return conn.transaction(() => {
        const now = new Date().toISOString();
        const nextVersion = record.version + 1;
        const serialized = JSON.stringify(validated);
        if (record.version === 0) {
          const exists = conn
            .prepare('SELECT id FROM case_folder_domain_state WHERE id=?')
            .get(scopeId);
          if (exists) throw new CaseConflictError();
          conn
            .prepare(
              'INSERT INTO case_folder_domain_state (id, data, version, updated_at) VALUES (?, ?, ?, ?)',
            )
            .run(scopeId, serialized, nextVersion, now);
        } else {
          const res = conn
            .prepare(
              'UPDATE case_folder_domain_state SET data=?, version=?, updated_at=? WHERE id=? AND version=?',
            )
            .run(serialized, nextVersion, now, scopeId, record.version);
          if (Number(res.changes) === 0) throw new CaseConflictError();
        }
        return {
          data: structuredClone(validated),
          version: nextVersion,
          updatedAt: now,
        };
      })();
    },
    update(mutator) {
      const current = this.load();
      const nextData = mutator(current.data);
      return this.save({...current, data: nextData});
    },
  });
}
