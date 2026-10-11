import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const root = fs.realpathSync.native(fileURLToPath(new URL('../', import.meta.url)));
try {
  const stateFile = path.join(root, 'output', 'desktop', 'server.json');
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    let running = false; try { process.kill(state.pid, 0); running = true; } catch { }
    if (running) throw new Error('Close Sarabun with Stop-Sarabun.cmd before exporting. Your source data was not changed.');
  }
  try {
    const response = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(1500) });
    if (response.ok) throw new Error('Stop the running dev or desktop server before exporting.');
  } catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.desktop', 'current.json'), 'utf8'));
  if (!/^[\w-]+$/.test(manifest.version)) throw new Error('Invalid desktop version.');
  const target = path.join(root, 'releases', 'Sarabun-Windows-' + new Date().toISOString().replace(/[:.]/g, '-'));
  if (fs.existsSync(target)) throw new Error('Export directory already exists.');
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(path.join(root, '.desktop', 'versions', manifest.version), path.join(target, '.desktop', 'versions', manifest.version), { recursive: true });
  fs.cpSync(path.join(root, '.desktop', 'runtime'), path.join(target, '.desktop', 'runtime'), { recursive: true });
  fs.copyFileSync(path.join(root, '.desktop', 'current.json'), path.join(target, '.desktop', 'current.json'));
  fs.mkdirSync(path.join(target, 'scripts'));
  for (const file of ['update-desktop.mjs', 'update-desktop.ps1', 'backup-worker.mjs', 'workspace-backup.mjs', 'desktop.mjs', 'export-desktop.mjs', 'restore-backup.mjs', 'configure-production.mjs', 'setup-production.ps1']) fs.copyFileSync(path.join(root, 'scripts', file), path.join(target, 'scripts', file));
  for (const file of ['Update-Sarabun.cmd', 'Rollback-Sarabun.cmd', 'CHANGELOG.md', 'Open-Sarabun.cmd', 'Stop-Sarabun.cmd', 'Export-Sarabun.cmd', 'Setup-Sarabun-Production.cmd', 'DESKTOP-README.md', 'QUICK-START-TH.md']) fs.copyFileSync(path.join(root, file), path.join(target, file));
  const empty = process.argv.includes('--empty');
  fs.mkdirSync(path.join(target, 'data'));
  if (fs.existsSync(path.join(root, 'data'))) fs.cpSync(path.join(root, 'data'), path.join(target, 'data'), { recursive: true, filter: file => !/\.sqlite(?:-wal|-shm)?$/.test(file) });
  if (!empty) {
    const env = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8').replace(/^\uFEFF/, ''));
    const source = path.resolve(root, env.DATABASE_PATH || 'data/sarabun.sqlite');
    const dest = path.join(target, 'data', 'sarabun.sqlite');
    // VACUUM INTO creates a consistent snapshot, including committed WAL contents.
    const db = new DatabaseSync(source, { readOnly: true });
    try { db.exec("VACUUM INTO '" + dest.replaceAll("'", "''") + "'"); } finally { db.close(); }
    const copy = new DatabaseSync(dest);
    try {
      if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Export database integrity check failed.');
      // Machine-specific output folders must not continue writing to the previous PC.
      copy.prepare("DELETE FROM settings WHERE key IN ('storage:local','storage:backupRoot','storage:lastExport','backup:auto:state','backup:auto:lease')").run();
    } finally { copy.close(); }
    let config = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
    config = config.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?(?:DATABASE_PATH|CHROMIUM_EXECUTABLE_PATH|SARABUN_SOURCE_DIR|SARABUN_DESKTOP_TOKEN|SARABUN_DESKTOP_INSTANCE|APP_URL)\s*=/.test(line)).join('\n');
    fs.writeFileSync(path.join(target, '.env.local'), config + '\nDATABASE_PATH=./data/sarabun.sqlite\nAPP_URL=http://127.0.0.1:3000\n');
  }
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(path.join(target, 'package-info.json'), JSON.stringify({ ...manifest, includesPersonalData: !empty, nodeSha256: hash(path.join(target, '.desktop', 'runtime', 'node.exe')), exported: new Date().toISOString() }, null, 2));
  console.log('Portable copy created: ' + target);
  console.log(empty ? 'New installation without your credentials or documents.' : 'Includes your documents and private settings. Keep this folder private. The original data is unchanged.');
  if (!process.argv.includes('--no-explorer')) {
    const { spawn } = await import('node:child_process');
    const child = spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }); child.unref();
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
