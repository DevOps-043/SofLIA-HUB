import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { spawn } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { setTimeout, clearTimeout } from 'node:timers';
import { pipeline } from 'node:stream/promises';
import ts from 'typescript';

// Opt-in de desarrollo para Windows. Nunca arranca bootstrap ni carga .env.
const root = fileURLToPath(new URL('../../', import.meta.url));
const onlyLifecycle = process.argv.includes('--lifecycle-only');
const onlyVault = process.argv.includes('--vault-only');
const onlyAutosave = process.argv.includes('--autosave-only');
const onlySafety = process.argv.includes('--safety-only');
const onlyZoom = process.argv.includes('--zoom-only');
const onlyPasskeys = process.argv.includes('--passkeys-only');
const onlyExtensions = process.argv.includes('--extensions-only');
const onlyCatalog = process.argv.includes('--catalog-only');
const onlyPolicies = process.argv.includes('--policies-only');
assert.ok([onlyLifecycle, onlyVault, onlyAutosave, onlySafety, onlyZoom, onlyPasskeys, onlyExtensions, onlyCatalog, onlyPolicies].filter(Boolean).length <= 1, 'Selecciona una sola fase focalizada.');
const args = process.argv.slice(2).filter((arg) => !['--lifecycle-only', '--vault-only', '--autosave-only', '--safety-only', '--zoom-only', '--passkeys-only', '--extensions-only', '--catalog-only', '--policies-only'].includes(arg));
assert.equal(process.platform, 'win32', 'Este smoke nativo sólo está preparado para Windows.');
assert.ok(args.length === 1 && args[0] === '--download-runtime'
  || args.length === 2 && args[0] === '--electron' && path.isAbsolute(args[1]),
'Usa --download-runtime o --electron RUTA_ABSOLUTA_AL_EJECUTABLE.');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = manifest.devDependencies.electron;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Se exige una versión estable exacta.');
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-browser-smoke-'));
console.log(`[Smoke] Directorio aislado: ${sandbox}`);

function run(command, commandArgs, extraEnv = {}, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    // No heredar NODE_OPTIONS, tokens de proveedores ni el modo Node de Electron.
    const env = {};
    for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    const child = spawn(command, commandArgs, {
      cwd: sandbox, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, ...extraEnv },
    });
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
    const timeout = setTimeout(() => {
      child.kill(); // Sólo el proceso que creó este runner; nunca busca otros Electron.
      reject(new Error('El proceso de smoke superó su límite de tiempo.'));
    }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`El proceso de smoke terminó con código ${code}.`));
    });
  });
}

async function downloadRuntime() {
  assert.ok(['x64', 'arm64'].includes(process.arch), 'Arquitectura no cubierta por el smoke.');
  const filename = `electron-v${version}-win32-${process.arch}.zip`;
  const official = `https://github.com/electron/electron/releases/download/v${version}/`;
  console.log(`[Smoke] Descargando Electron ${version} oficial; se verificará SHA-256 antes de extraer.`);
  const sums = await globalThis.fetch(`${official}SHASUMS256.txt`, { signal: globalThis.AbortSignal.timeout(30_000) });
  assert.ok(sums.ok, `No se obtuvo la lista de hashes: ${sums.status}.`);
  const expected = (await sums.text()).split(/\r?\n/)
    .map((line) => line.trim().split(/\s+\*?/)).find((parts) => parts[1] === filename)?.[0];
  assert.match(expected ?? '', /^[a-f0-9]{64}$/i, 'No hay hash válido para el artefacto.');
  const response = await globalThis.fetch(`${official}${filename}`, { signal: globalThis.AbortSignal.timeout(180_000) });
  assert.ok(response.ok && response.body, `No se obtuvo el runtime: ${response.status}.`);
  const zip = path.join(sandbox, filename);
  await pipeline(response.body, createWriteStream(zip, { flags: 'wx' }));
  const hash = createHash('sha256');
  for await (const part of createReadStream(zip)) hash.update(part);
  assert.equal(hash.digest('hex'), expected.toLowerCase(), 'El runtime no coincide con el hash oficial.');
  const runtime = path.join(sandbox, 'runtime');
  // Argumentos vía entorno propio y LiteralPath: no interpolar rutas como código.
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:PULSE_SMOKE_ZIP -DestinationPath $env:PULSE_SMOKE_RUNTIME"],
  { PULSE_SMOKE_ZIP: zip, PULSE_SMOKE_RUNTIME: runtime });
  return path.join(runtime, 'electron.exe');
}

try {
  const executable = args[0] === '--download-runtime' ? await downloadRuntime() : args[1];
  // Transpilar módulos reales, sin empaquetar ni sustituir Electron por un mock.
  const modules = [
    'integrated-browser/platform-types', 'integrated-browser/profile-scope',
    'integrated-browser/session-store', 'integrated-browser/browser-history-store',
    'integrated-browser/bookmark-store', 'integrated-browser/diagnostic-report',
    'integrated-browser/page-tools', 'integrated-browser/download-manager', 'main/shutdown-guard',
    'main/app-lifecycle', 'app-protocol',
    'integrated-browser/credential-vault', 'integrated-browser/credential-vault-format',
    'integrated-browser/credential-errors',
    'integrated-browser/agent-audit-store', 'integrated-browser/sqlite-schema',
    'integrated-browser/sqlite-store-recovery',
    'integrated-browser/semantic-memory-store', 'integrated-browser/semantic-memory-recovery',
    'integrated-browser/policy-file-recovery', 'integrated-browser/site-permissions', 'integrated-browser/types',
    'integrated-browser/privacy-store', 'integrated-browser/agent-policy-store',
    'integrated-browser/agent-shortcut-store', 'integrated-browser/sync-settings-store', 'integrated-browser/sync-remote',
    'integrated-browser/sync-checkpoint-store', 'integrated-browser/sync-recovery-guard', 'integrated-browser/sync-state-recovery',
    'integrated-browser/certificate-policy',
    'integrated-browser/sync-crypto', 'integrated-browser/sync-conflicts', 'integrated-browser/sync-conflict-store',
    'integrated-browser/credential-autosave', 'integrated-browser/credential-autosave-script',
    'integrated-browser/cdp-session',
    'integrated-browser/tab-zoom',
    'integrated-browser/passkey-selection',
    'integrated-browser/extension-manager', 'integrated-browser/extension-site-access',
    'integrated-browser/extension-catalog',
    'integrated-browser/safe-navigation', 'integrated-browser/request-safety',
    'integrated-browser/safety-interstitial',
  ];
  for (const module of modules) {
    const source = await fs.readFile(path.join(root, 'electron', `${module}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const destination = path.join(sandbox, 'compiled', `${module}.js`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, compiled.outputText, { flag: 'wx' });
  }
  let hasLimitations = false;
  // El store real de atajos consume el mismo validador compartido que la UI.
  const shortcutSource = await fs.readFile(path.join(root, 'src/shared/browser-agent-shortcuts.ts'), 'utf8');
  const shortcutTarget = path.join(sandbox, 'src/shared/browser-agent-shortcuts.js');
  await fs.mkdir(path.dirname(shortcutTarget), { recursive: true });
  await fs.writeFile(shortcutTarget, ts.transpileModule(shortcutSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { flag: 'wx' });
  const semanticSource = await fs.readFile(path.join(root, 'src/shared/browser-semantic-memory.ts'), 'utf8');
  await fs.writeFile(path.join(sandbox, 'src/shared/browser-semantic-memory.js'), ts.transpileModule(semanticSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { flag: 'wx' });
  for (const phase of onlyPolicies ? ['policies'] : onlyCatalog ? ['catalog'] : onlyExtensions ? ['extensions'] : onlyPasskeys ? ['passkeys'] : onlyZoom ? ['zoom'] : onlyLifecycle ? ['lifecycle'] : onlyVault ? ['vault'] : onlyAutosave ? ['autosave'] : onlySafety ? ['safety'] : ['exercise', 'restore', 'lifecycle', 'vault', 'autosave', 'zoom', 'safety', 'passkeys', 'extensions', 'policies']) {
    const harness = path.join(root, phase === 'safety' ? 'test/manual/browser-native/safety.mjs' : ['lifecycle', 'vault', 'autosave', 'zoom', 'passkeys', 'extensions', 'catalog', 'policies'].includes(phase) ? `test/manual/browser-native/${phase}.cjs` : 'test/manual/browser-native/main.cjs');
    await run(executable, [harness, sandbox, version, phase]);
    const report = JSON.parse(await fs.readFile(path.join(sandbox, `${phase}.json`), 'utf8'));
    assert.equal(report.status, 'passed');
    assert.equal(report.electron, version);
    console.log(`[Smoke] ${phase}: ${report.checks.length} comprobaciones aprobadas.`);
    hasLimitations ||= report.limitations.length > 0;
    for (const limitation of report.limitations) console.warn(`[Smoke] Limitación observada: ${limitation}`);
  }
  if (hasLimitations) {
    process.exitCode = 2;
    console.warn('[Smoke] Verificación parcial: quedan limitaciones funcionales observadas (código 2).');
  }
  console.log('[Smoke] Prueba nativa focalizada completada. No equivale a smoke de toda la aplicación ni del instalador.');
} finally {
  // Se preserva evidencia y runtime para repetir sin descargar; no borrar perfiles.
  console.log(`[Smoke] Evidencia y artefactos temporales conservados en: ${sandbox}`);
}
