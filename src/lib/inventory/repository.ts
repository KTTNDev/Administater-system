import {createEmptyInventoryState} from './fifo-engine';
import {InventoryDomainStateSchema} from './schema';
import type {InventoryDomainState} from './types';

export interface InventoryStateRecord {
  data: InventoryDomainState;
  version: number;
  updatedAt: string;
}

export class InventoryConflictError extends Error {
  constructor() {
    super('ข้อมูลคลังวัสดุถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
    this.name = 'InventoryConflictError';
  }
}

export interface InventoryRepository {
  load(): InventoryStateRecord;
  save(record: InventoryStateRecord): InventoryStateRecord;
  update(mutator: (current: InventoryDomainState) => InventoryDomainState): InventoryStateRecord;
}

export const INVENTORY_DOMAIN_SQL =
  'id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL';

export function createMemoryInventoryRepository(
  initialState: InventoryDomainState = createEmptyInventoryState(),
): InventoryRepository {
  let stored: InventoryStateRecord = {
    data: InventoryDomainStateSchema.parse(structuredClone(initialState)),
    version: 0,
    updatedAt: '',
  };

  return {
    load() {
      return {
        data: InventoryDomainStateSchema.parse(structuredClone(stored.data)),
        version: stored.version,
        updatedAt: stored.updatedAt,
      };
    },
    save(record) {
      if (record.version !== stored.version) throw new InventoryConflictError();
      const validated = InventoryDomainStateSchema.parse(record.data);
      const next: InventoryStateRecord = {
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
  };
}

export interface SqliteLike {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): {changes: number | bigint};
  };
  transaction<T>(operation: () => T): () => T;
}

/**
 * Persistence adapter matching sarabun-workspace's optimistic-version SQLite pattern
 * (`src/lib/procurement/storage/sqlite.ts`). Uses an isolated `inventory_domain_state`
 * table so existing legacy `inventory_items` / `inventory_movements` tables remain untouched.
 */
export function createSqliteInventoryRepository(
  getDb: () => SqliteLike,
  scopeId = 'default',
): InventoryRepository {
  const ensureTable = () => {
    const conn = getDb();
    conn.exec(`CREATE TABLE IF NOT EXISTS inventory_domain_state (${INVENTORY_DOMAIN_SQL})`);
    return conn;
  };

  return {
    load() {
      const conn = ensureTable();
      const row = conn
        .prepare('SELECT data, version, updated_at FROM inventory_domain_state WHERE id=?')
        .get(scopeId);
      if (!row) {
        return {
          data: createEmptyInventoryState(),
          version: 0,
          updatedAt: '',
        };
      }
      return {
        data: InventoryDomainStateSchema.parse(JSON.parse(String(row.data))),
        version: Number(row.version),
        updatedAt: String(row.updated_at),
      };
    },

    save(record) {
      const validated = InventoryDomainStateSchema.parse(record.data);
      const conn = ensureTable();
      return conn.transaction(() => {
        const now = new Date().toISOString();
        const nextVersion = record.version + 1;
        const serialized = JSON.stringify(validated);
        if (record.version === 0) {
          const exists = conn
            .prepare('SELECT id FROM inventory_domain_state WHERE id=?')
            .get(scopeId);
          if (exists) throw new InventoryConflictError();
          conn
            .prepare('INSERT INTO inventory_domain_state VALUES(?,?,?,?)')
            .run(scopeId, serialized, nextVersion, now);
        } else {
          const res = conn
            .prepare('UPDATE inventory_domain_state SET data=?, version=?, updated_at=? WHERE id=? AND version=?')
            .run(serialized, nextVersion, now, scopeId, record.version);
          if (!Number(res.changes)) throw new InventoryConflictError();
        }
        return {data: structuredClone(validated), version: nextVersion, updatedAt: now};
      })();
    },

    update(mutator) {
      const current = this.load();
      const nextData = mutator(current.data);
      return this.save({...current, data: nextData});
    },
  };
}
