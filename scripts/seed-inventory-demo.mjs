import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'vite';
import {resolveDatabaseFile} from './data-location.mjs';

const root = process.cwd();
const backupPath = path.join(root, 'output', 'inventory-demo-backup.json');
const mode = process.argv.includes('--reset') ? 'reset' : 'apply';

function readEnvDatabasePath() {
  const envFile = path.join(root, '.env.local');
  if (!fs.existsSync(envFile)) return process.env.DATABASE_PATH || 'data/sarabun.sqlite';
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*DATABASE_PATH\s*=\s*(.*)\s*$/.exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  return process.env.DATABASE_PATH || 'data/sarabun.sqlite';
}

const dbFile = resolveDatabaseFile(root, readEnvDatabasePath(), true);
console.log('Target DB (inventory_domain_state ONLY):', dbFile);

const conn = new DatabaseSync(dbFile);
conn.exec(
  'CREATE TABLE IF NOT EXISTS inventory_domain_state (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)',
);

if (mode === 'reset') {
  if (fs.existsSync(backupPath)) {
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    if (backup.row) {
      conn
        .prepare(
          "INSERT INTO inventory_domain_state (id, data, version, updated_at) VALUES ('default', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=excluded.version, updated_at=excluded.updated_at",
        )
        .run(backup.row.data, backup.row.version, backup.row.updated_at);
      console.log('Restored previous inventory_domain_state from backup.');
    } else {
      conn.prepare("DELETE FROM inventory_domain_state WHERE id = 'default'").run();
      console.log('Cleared demo data; restored empty inventory_domain_state.');
    }
  } else {
    conn.prepare("DELETE FROM inventory_domain_state WHERE id = 'default'").run();
    console.log('Cleared demo data from inventory_domain_state.');
  }
  conn.close();
  process.exit(0);
}

// Save pre-demo backup once
if (!fs.existsSync(backupPath)) {
  const existing = conn
    .prepare("SELECT data, version, updated_at FROM inventory_domain_state WHERE id = 'default'")
    .get();
  fs.mkdirSync(path.dirname(backupPath), {recursive: true});
  fs.writeFileSync(
    backupPath,
    JSON.stringify({savedAt: new Date().toISOString(), dbFile, row: existing ?? null}, null, 2),
    'utf8',
  );
  console.log('Saved pre-demo backup to:', backupPath);
}

const vite = await createServer({
  root,
  server: {middlewareMode: true},
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await vite.ssrLoadModule('/src/lib/inventory/demo-fy-simulation.ts');
  const demo = mod.buildFullFiscalYearDemoState();
  const current = conn
    .prepare("SELECT version FROM inventory_domain_state WHERE id = 'default'")
    .get();
  const nextVersion = current ? Number(current.version) + 1 : 1;
  const now = new Date().toISOString();

  conn
    .prepare(
      "INSERT INTO inventory_domain_state (id, data, version, updated_at) VALUES ('default', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=excluded.version, updated_at=excluded.updated_at",
    )
    .run(JSON.stringify(demo.state), nextVersion, now);

  console.log('\n=== Seeded 10-Material Full Fiscal Year Simulation (FY 2569 -> Carry-Forward -> FY 2570) ===');
  console.log(
    `FY 2569 Summary: Open=${demo.fy2569Summary.totals.openingQty} (${demo.fy2569Summary.totals.openingAmount.toFixed(2)} THB)` +
      ` | In=${demo.fy2569Summary.totals.totalInQty} (${demo.fy2569Summary.totals.totalInAmount.toFixed(2)} THB)` +
      ` | Out=${demo.fy2569Summary.totals.totalOutQty} (${demo.fy2569Summary.totals.totalOutAmount.toFixed(2)} THB)` +
      ` | Close=${demo.fy2569Summary.totals.closingQty} (${demo.fy2569Summary.totals.closingAmount.toFixed(2)} THB)` +
      ` | Balanced=${demo.fy2569Summary.allBalanced}`,
  );
  for (let i = 0; i < demo.fy2569Quarters.length; i += 1) {
    const q = demo.fy2569Quarters[i];
    console.log(
      `  Q${i + 1} (${q.periodStart}..${q.periodEnd}): Open=${q.totals.openingAmount.toFixed(2)} + In=${q.totals.totalInAmount.toFixed(2)} - Out=${q.totals.totalOutAmount.toFixed(2)} = Close=${q.totals.closingAmount.toFixed(2)} THB | Balanced=${q.allBalanced}`,
    );
  }
  console.log(
    `Carry-Forward (1 ต.ค. 2569 / FY 2570): ${demo.carryForward.carriedMaterialCount} materials, ${demo.carryForward.carriedLotCount} FIFO lots, ${demo.carryForward.totalCarriedQty} units, ${demo.carryForward.totalCarriedAmount.toFixed(2)} THB`,
  );
  console.log(
    `FY 2570 Current: Open=${demo.fy2570Summary.totals.openingQty} (${demo.fy2570Summary.totals.openingAmount.toFixed(2)} THB)` +
      ` | In=${demo.fy2570Summary.totals.totalInQty} (${demo.fy2570Summary.totals.totalInAmount.toFixed(2)} THB)` +
      ` | Out=${demo.fy2570Summary.totals.totalOutQty} (${demo.fy2570Summary.totals.totalOutAmount.toFixed(2)} THB)` +
      ` | Close=${demo.fy2570Summary.totals.closingQty} (${demo.fy2570Summary.totals.closingAmount.toFixed(2)} THB)` +
      ` | Balanced=${demo.fy2570Summary.allBalanced}`,
  );
  console.log('\nPer-Material FY 2569 Closing -> FY 2570 Live:');
  for (const m of demo.fy2569Summary.items) {
    const m70 = demo.fy2570Summary.items.find(x => x.materialId === m.materialId);
    console.log(
      `  #${String(m.ledgerSeqNo).padStart(2, '0')} [${m.categoryCode}] ${m.name} (${m.unit}):` +
        ` FY69 Open=${m.openingQty} In=${m.totalInQty} Out=${m.totalOutQty} Close=${m.closingQty} (${m.closingAmount.toFixed(2)} บ.)` +
        ` -> FY70 Open=${m70.openingQty} In=${m70.totalInQty} Out=${m70.totalOutQty} Live=${m70.closingQty} (Reserved=${m70.reservedQty}, Avail=${m70.availableQty}, Val=${m70.closingAmount.toFixed(2)} บ.)`,
    );
  }
} finally {
  await vite.close();
  conn.close();
}
