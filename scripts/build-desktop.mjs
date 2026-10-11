import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fs.realpathSync.native(fileURLToPath(new URL('../', import.meta.url)));
process.chdir(root);
try {
  if (process.platform !== 'win32') throw new Error('Build this Windows package on Windows.');
  if (!process.argv.includes('--skip-build')) {
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: root, stdio: 'inherit', env: { ...process.env, SARABUN_BUILD: 'desktop' } });
    if (result.status !== 0) throw new Error('Build failed. The previous desktop version is unchanged.');
  }
  const source = path.join(root, '.next-desktop', 'standalone');
  const buildId = fs.readFileSync(path.join(root, '.next-desktop', 'BUILD_ID'), 'utf8').trim();
  if (!/^[\w-]+$/.test(buildId)) throw new Error('Invalid BUILD_ID.');
  const version = buildId + '-' + Date.now();
  const target = path.join(root, '.desktop', 'versions', version);
  fs.mkdirSync(target, { recursive: true });
  // Tracing can over-include mutable data through dynamic filesystem access.
  // Only ship runtime files; business data is snapshotted separately on export.
  fs.mkdirSync(path.join(target, 'app'));
  for (const name of ['.next-desktop', 'node_modules', 'server.js', 'package.json']) {
    fs.cpSync(path.join(source, name), path.join(target, 'app', name), { recursive: true, dereference: true, filter: file => !path.basename(file).startsWith('.env') });
  }
  fs.cpSync(path.join(root, 'public'), path.join(target, 'app', 'public'), { recursive: true });
  fs.cpSync(path.join(root, '.next-desktop', 'static'), path.join(target, 'app', '.next-desktop', 'static'), { recursive: true });
  const runtime = path.join(root, '.desktop', 'runtime');
  fs.mkdirSync(runtime, { recursive: true });
  const binary = path.join(runtime, 'node.exe');
  if (fs.realpathSync.native(process.execPath).toLowerCase() !== path.resolve(binary).toLowerCase()) {
    const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (!fs.existsSync(binary) || hash(binary) !== hash(process.execPath)) {
      try { fs.copyFileSync(process.execPath, binary); }
      catch { throw new Error('Stop Sarabun before updating its Node.js runtime. The previous build is unchanged.'); }
    }
  }
  // Include the bundled runtime's complete third-party license notices.
  const license = path.join(path.dirname(process.execPath), 'LICENSE');
  if (fs.existsSync(license)) fs.copyFileSync(license, path.join(runtime, 'NODE-LICENSE.txt'));
  else {
    const cache = path.join(root, 'scripts', 'runtime-licenses', 'node-' + process.version + '.txt');
    if (!fs.existsSync(cache)) {
      const response = await fetch('https://raw.githubusercontent.com/nodejs/node/' + process.version + '/LICENSE', { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Could not obtain Node.js license notices.');
      const text = await response.text();
      if (!text.includes('Node.js is licensed') || text.length < 1000) throw new Error('Unexpected Node.js license content.');
      fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, text);
    }
    fs.copyFileSync(cache, path.join(runtime, 'NODE-LICENSE.txt'));
  }
  fs.writeFileSync(path.join(root, '.desktop', 'current.json.new'), JSON.stringify({ appVersion: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, version, built: new Date().toISOString(), platform: process.platform, arch: process.arch, node: process.version }, null, 2));
  fs.renameSync(path.join(root, '.desktop', 'current.json.new'), path.join(root, '.desktop', 'current.json'));
  console.log('Desktop build ready. Open Open-Sarabun.cmd. No npm or compilation is needed for normal use.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
