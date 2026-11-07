const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function lockOwnFile(file, root) {
  assert.ok(path.resolve(file).startsWith(path.resolve(root) + path.sep));
  const env = {};
  for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  env.SOFLIA_QA_LOCK_FILE = file; env.SOFLIA_QA_LOCK_ROOT = root;
  const script = `
    $ErrorActionPreference='Stop'
    $qaFile=[IO.Path]::GetFullPath($env:SOFLIA_QA_LOCK_FILE)
    $qaRoot=[IO.Path]::GetFullPath($env:SOFLIA_QA_LOCK_ROOT)+[IO.Path]::DirectorySeparatorChar
    if (!$qaFile.StartsWith($qaRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta QA inválida' }
    $qaHandle=[IO.File]::Open($qaFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try { [Console]::WriteLine('BLOQUEO_LISTO'); [Console]::ReadLine() | Out-Null } finally { $qaHandle.Dispose() }
  `;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let ready = false;
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Falló el bloqueo propio de QA.'))); });
  // Un fallo temprano tampoco debe quedar como rechazo sin observador.
  void exited.catch(() => {});
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('El bloqueo QA no quedó listo.')); }, 10_000);
      let output = '';
      child.stdout.on('data', bytes => {
        output = (output + bytes.toString()).slice(-200);
        if (!ready && output.includes('BLOQUEO_LISTO')) { ready = true; clearTimeout(timer); resolve(); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); if (!ready) reject(new Error('El bloqueo QA terminó antes de estar listo.')); });
      child.stderr.resume();
    });
    return { release: async () => { if (!child.stdin.destroyed) child.stdin.end('liberar\n'); await exited; } };
  } catch (error) { if (!child.stdin.destroyed) child.stdin.end('liberar\n'); await exited.catch(() => {}); throw error; }
}

module.exports = async function exerciseWindowsPolicyPublication({ sandbox, load, check }) {
  const root = path.join(sandbox, 'policies', 'publication'); fs.mkdirSync(root, { recursive: true });
  const { BrowserPrivacyStore } = load('privacy-store');
  const origin = 'https://fixture.example';
  const file = path.join(root, 'privacy.json'), store = new BrowserPrivacyStore(file);
  await store.set({ origin, level: 'off', exceptionCategories: ['advertising'] });
  const locker = await lockOwnFile(file, root);
  const rename = fsp.rename; let sharingFailures = 0, release;
  fsp.rename = async (...args) => {
    try { return await rename(...args); }
    catch (error) {
      if (String(args[1]) === file && error.code === 'EPERM') {
        sharingFailures++;
        if (!release) release = new Promise((resolve, reject) => setTimeout(() => { locker.release().then(resolve, reject); }, 25));
      }
      throw error;
    }
  };
  try {
    await store.set({ origin, level: 'strict', exceptionCategories: [] });
    assert.ok(sharingFailures > 0, 'La prueba debe observar un EPERM real antes de liberar el archivo.');
    assert.equal((await store.get(origin)).level, 'strict');
    check('publicación: bloqueo Windows real y transitorio se recupera sin perder el cambio');
  } finally { fsp.rename = rename; await (release || locker.release()); }

  const before = fs.readFileSync(file), permanent = await lockOwnFile(file, root);
  try {
    await assert.rejects(store.set({ origin, level: 'balanced', exceptionCategories: [] }));
    assert.deepEqual(fs.readFileSync(file), before);
    check('publicación: bloqueo persistente falla con principal previo intacto');
  } finally { await permanent.release(); }
};
