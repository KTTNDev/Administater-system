import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEnv } from 'node:util';

const root = fs.realpathSync.native(fileURLToPath(new URL('../', import.meta.url)));
const base = 'http://127.0.0.1:3000';
const instance = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 24);
const logs = path.join(root, 'output', 'desktop');
const stateFile = path.join(logs, 'server.json');
const lockFile = path.join(logs, 'start.lock');
const command = process.argv[2] || 'start';
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; } };

function installation() {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, '.desktop', 'current.json'), 'utf8'));
  if (!/^[\w-]+$/.test(version)) throw new Error('Invalid desktop version. Run Build-Sarabun.cmd again.');
  const folder = path.join(root, '.desktop', 'versions', version);
  if (!fs.existsSync(path.join(folder, 'app', 'server.js'))) throw new Error('Desktop files are incomplete. Run Build-Sarabun.cmd.');
  return folder;
}
async function health() {
  try {
    const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500), redirect: 'error' });
    if (!response.ok) throw new Error('Port 3000 is occupied by another application.');
    const value = await response.json();
    if (value.application !== 'sarabun' || value.instance !== instance || value.mode !== 'start') throw new Error('Port 3000 is used by another server. Close that server before opening this copy.');
    return value;
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw error;
  }
}
function config() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) fs.writeFileSync(file, `SESSION_SECRET=${randomBytes(48).toString('hex')}\nAPP_URL=${base}\nDATABASE_PATH=./data/sarabun.sqlite\n`, { flag: 'wx' });
  const values = parseEnv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if ((values.SESSION_SECRET || '').length < 32) throw new Error('SESSION_SECRET is missing or too short. Restore your configuration; do not replace the existing Drive encryption key.');
  return values;
}
function openBrowser(token) {
  if (process.argv.includes('--no-browser')) return;
  const requireLogin = (config().SARABUN_REQUIRE_LOGIN ?? process.env.SARABUN_REQUIRE_LOGIN) === "true";
  const url = requireLogin ? `${base}/desktop#token=${token}` : base;
  const browser = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ].find(file => fs.existsSync(file));
  if (browser) {
    const child = spawn(browser, ['--app=' + url], { detached: true, stdio: 'ignore', windowsHide: false });
    child.on('error', () => console.error('Could not open browser. Run Open-Sarabun.cmd again.'));
    child.unref();
  } else {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Process -FilePath $env:SARABUN_OPEN_URL'], { env: { ...process.env, SARABUN_OPEN_URL: url }, windowsHide: true });
    if (result.status !== 0) throw new Error('Install Microsoft Edge or Google Chrome, then open again.');
  }
}
async function lock(operation) {
  fs.mkdirSync(logs, { recursive: true });
  for (let tries = 0; tries < 150; tries++) {
    try { fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), { flag: 'wx' }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner; try { owner = JSON.parse(fs.readFileSync(lockFile, 'utf8')); } catch { }
      if (owner && !alive(owner.pid)) { fs.unlinkSync(lockFile); continue; }
      if (tries === 149) throw new Error('Another launch is still in progress. Check output/desktop logs.');
      await delay(1000);
    }
  }
  try { return await operation(); } finally { fs.unlinkSync(lockFile); }
}
async function start() {
  if(process.env.SARABUN_UPDATING!=='1' && (fs.existsSync(path.join(root,'.desktop/update.lock'))||fs.existsSync(path.join(root,'.desktop/pending-update.json'))))throw new Error('Update in progress or interrupted. Wait for it to finish, or run Rollback-Sarabun.cmd to recover.');
  return lock(async () => {
    const running = await health();
    if (running) {
      const state = readState();
      if (state?.pid !== running.pid || !state.token) throw new Error('Server state differs. Close the existing server before reopening.');
      openBrowser(state.token); console.log('Sarabun is already running. Opened the existing window.'); return;
    }
    const folder = installation();
    config();
    const token = randomBytes(32).toString('hex');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stdout = fs.openSync(path.join(logs, stamp + '.log'), 'a');
    const stderr = fs.openSync(path.join(logs, stamp + '-error.log'), 'a');
    const node = path.join(root, '.desktop', 'runtime', 'node.exe');
    const server = spawn(node, [fileURLToPath(import.meta.url), 'serve'], {
      cwd: root, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr],
      env: { ...process.env, SARABUN_DESKTOP_TOKEN: token, SARABUN_DESKTOP_INSTANCE: instance },
    });
    fs.closeSync(stdout); fs.closeSync(stderr);
    await new Promise((resolve, reject) => { server.once('spawn', resolve); server.once('error', reject); });
    server.unref();
    fs.writeFileSync(stateFile, JSON.stringify({ pid: server.pid, token, instance, started: Date.now() }), { mode: 0o600 });
    const began = Date.now();
    try {
    for (let tries = 0; tries < 120; tries++) {
      if (!alive(server.pid)) throw new Error('Sarabun stopped during startup. See ' + logs);
      const ready = await health().catch(error => { if (error.name === 'TimeoutError') return null; throw error; });
      if (ready) {
        if (ready.pid !== server.pid) throw new Error('Another application took port 3000.');
        // Warm the authenticated dashboard as well, not just the health endpoint.
        const session = await fetch(base + '/api/desktop/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(60000) });
        if (!session.ok) throw new Error('Desktop sign-in failed. Check the server log.');
        const cookie = session.headers.get('set-cookie')?.split(';')[0];
        const page = await fetch(base, { headers: { Cookie: cookie || '' }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
        if (!page.ok) throw new Error('The dashboard could not load. See ' + logs);
        await page.arrayBuffer();
        console.log(`Sarabun ready in ${((Date.now() - began) / 1000).toFixed(1)}s: ${base}`);
        openBrowser(token); return;
      }
      await delay(500);
    }
    // This is the exact child created by this launch, not a port-wide kill.
    if (alive(server.pid)) server.kill();
    throw new Error('Startup timed out. See ' + logs);
    } catch (error) {
      if (alive(server.pid)) server.kill();
      if (readState()?.pid === server.pid) fs.unlinkSync(stateFile);
      throw error;
    }
  });
}
async function stop() {
  return lock(async () => {
    const running = await health();
    if (!running) { console.log('Sarabun is already stopped.'); return; }
    const state = readState();
    if (running.pid !== state?.pid || state.instance !== instance) throw new Error('Cannot verify server ownership; no process was stopped.');
    process.kill(state.pid);
    for (let i = 0; i < 40 && alive(state.pid); i++) await delay(250);
    if (alive(state.pid)) throw new Error('Server has not stopped yet. Wait and retry.');
    fs.unlinkSync(stateFile);
    console.log('Sarabun stopped. Your documents are saved in data/.');
  });
}
async function serve() {
  const values = config();
  Object.assign(process.env, values, { NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '3000', APP_URL: base, SARABUN_SOURCE_DIR: root, SARABUN_DESKTOP_INSTANCE: instance });
  const folder = installation();
  const browser = [path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'), path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe')].find(file => fs.existsSync(file));
  if (!values.CHROMIUM_EXECUTABLE_PATH && browser) process.env.CHROMIUM_EXECUTABLE_PATH = browser;
  await import(pathToFileURL(path.join(folder, 'app', 'server.js')).href);
}
try {
  if (command === 'start') await start();
  else if (command === 'stop') await stop();
  else if (command === 'serve') await serve();
  else if (command === 'status') console.log(await health() ? 'Sarabun is running.' : 'Sarabun is stopped.');
  else throw new Error('Usage: desktop.mjs start|stop|status');
} catch (error) { console.error(error.message); process.exitCode = 1; }
