// Sólo datos ficticios y APIs nativas; no se inicia el producto ni se leen perfiles reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'vault' || process.versions.electron !== expectedVersion) {
  console.error('[Smoke] Parámetros de bóveda inválidos.');
  app.exit(1);
}
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'vault', name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const load = (name) => require(path.join(sandbox, 'compiled', 'integrated-browser', name + '.js'));
const { BrowserCredentialVault } = load('credential-vault');
const { openCredentialVault } = load('credential-vault-format');
const { BrowserSyncConflictStore } = load('sync-conflict-store');
const scope = (file) => JSON.stringify([path.basename(path.dirname(file)), path.basename(file)]);
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  node: process.versions.node, phase, checks: [], limitations: [] };
function check(label) { report.checks.push(label); console.log('[Smoke] OK: ' + label); }

void app.whenReady().then(async () => {
  assert.ok(safeStorage.isEncryptionAvailable(), 'No hay almacenamiento seguro nativo.');
  const { BrowserAgentAuditStore } = load('agent-audit-store');
  const auditFile = path.join(sandbox, 'vault', 'audit.sqlite');
  const audit = new BrowserAgentAuditStore(auditFile);
  audit.record({ traceId: 'aaaa1111-bbbb-4444-8888-cccc99999999', tabId: 'pestaña-ficticia',
    url: 'https://audit.example/ruta-privada?clave=ficticia', operation: 'type', result: 'completed' });
  assert.equal(audit.list().entries[0].origin, 'https://audit.example');
  const auditBytes = fs.readFileSync(auditFile).toString();
  for (const value of ['audit.example', 'ruta-privada', 'ficticia']) assert.ok(!auditBytes.includes(value));
  assert.equal(new BrowserAgentAuditStore(auditFile).list().total, 1);
  audit.clear(); assert.equal(new BrowserAgentAuditStore(auditFile).list().total, 0);
  check('bitácora SQLite con DPAPI real, sin URL ni secreto en disco, reapertura y borrado verificados');
  const file = path.join(sandbox, 'vault', 'credentials.json');
  const backup = `${file}.bak`;
  const metadata = { id: 'aaaa1111-bbbb-4444-8888-cccc99999999', origin: 'https://smoke.example',
    username: 'cuenta-ficticia', createdAt: '2026-09-06T12:00:00.000Z', updatedAt: '2026-09-06T12:00:00.000Z' };
  const password = 'Contraseña-Ficticia-漢-91!';
  await fsp.writeFile(file, JSON.stringify({ version: 1, credentials: [{ ...metadata,
    passwordEncrypted: safeStorage.encryptString(password).toString('base64') }] }), { flag: 'wx', mode: 0o600 });
  const vault = new BrowserCredentialVault(file);
  assert.deepEqual(await vault.list(), [metadata]);
  assert.equal((await vault.resolveSecret(metadata.id, metadata.origin)).password, password);
  for (const target of [file, backup]) {
    const serialized = await fsp.readFile(target, 'utf8');
    assert.equal(JSON.parse(serialized).version, 2);
    for (const forbidden of [metadata.username, metadata.origin, password]) assert.ok(!serialized.includes(forbidden));
  }
  check('migración v1 a v2 con metadata cifrada y clave protegida por DPAPI real');
  const encrypted = await fsp.readFile(file, 'utf8');
  assert.deepEqual(await new BrowserCredentialVault(file).list(), [metadata]);
  assert.equal(await fsp.readFile(file, 'utf8'), encrypted);
  check('reapertura idempotente conserva identidad y contraseña');
  assert.throws(() => openCredentialVault(JSON.parse(encrypted), 'otro-perfil'));
  const altered = JSON.parse(encrypted);
  const bytes = Buffer.from(altered.ciphertext, 'base64'); bytes[0] ^= 1;
  altered.ciphertext = bytes.toString('base64');
  assert.throws(() => openCredentialVault(altered, scope(file)));
  check('se rechazan ciphertext alterado y ámbito ajeno antes de devolver datos');
  const retainedBackup = await fsp.readFile(backup, 'utf8');
  await fsp.unlink(file);
  await assert.rejects(vault.list()); await assert.rejects(vault.save(metadata.origin, { username: metadata.username, password }));
  const recovery = await vault.prepareRecovery(); assert.equal(recovery.count, 1);
  await assert.rejects(fsp.stat(file)); assert.equal(await fsp.readFile(backup, 'utf8'), retainedBackup);
  check('principal ausente bloquea nuevas escrituras y la revisión no publica secretos ni restaura sola');
  assert.equal(await recovery.commit(() => undefined), 1);
  assert.deepEqual(await vault.list(), [metadata]); assert.equal(await vault.getAutosaveEnabled(), false);
  assert.equal((await vault.resolveSecret(metadata.id, metadata.origin)).password, password);
  assert.equal(await fsp.readFile(backup, 'utf8'), retainedBackup);
  assert.ok(!(await fsp.readdir(path.dirname(file))).some((entry) => entry.endsWith('.tmp')));
  check('recuperación exclusiva con DPAPI real conserva identidad, respaldo y contraseña sin activar sugerencias');
  const damaged = JSON.stringify(altered);
  await fsp.writeFile(file, damaged);
  const damagedRecovery = await vault.prepareRecovery();
  assert.equal(await fsp.readFile(file, 'utf8'), damaged);
  assert.equal(await damagedRecovery.commit(() => undefined), 1);
  const archiveName = (await fsp.readdir(path.dirname(file))).find((name) => name.startsWith(path.basename(file) + '.corrupt-'));
  assert.ok(archiveName);
  const archiveFile = path.join(path.dirname(file), archiveName);
  const archive = JSON.parse(await fsp.readFile(archiveFile, 'utf8'));
  const original = JSON.parse(safeStorage.decryptString(Buffer.from(archive.protectedOriginal, 'base64')));
  assert.equal(original.scope, scope(file));
  assert.equal(Buffer.from(original.original, 'base64').toString('utf8'), damaged);
  assert.equal((await vault.resolveSecret(metadata.id, metadata.origin)).password, password);
  check('principal dañado recuperado con copia original cifrada por DPAPI real y sin activar sugerencias');
  assert.equal(await vault.clearAll(), 1);
  await assert.rejects(fsp.stat(archiveFile));
  for (const target of [file, backup]) {
    const decoded = JSON.parse(openCredentialVault(JSON.parse(await fsp.readFile(target, 'utf8')), scope(file)));
    assert.deepEqual(decoded.credentials, []);
  }
  check('borrado retira credenciales del principal, respaldo y copia cifrada de recuperación');

  const syncFile = path.join(sandbox, 'vault', 'sync-conflicts.json');
  const syncStore = new BrowserSyncConflictStore(syncFile);
  const snapshot = (title) => [{ id: 'b', title, url: 'https://sync-smoke.example/' }];
  const review = await syncStore.prepare({ category: 'bookmarks', baseRevision: 1, remoteRevision: 2,
    base: snapshot('Base ficticia'), local: snapshot('Local ficticio'), remote: snapshot('Remoto ficticio') }, () => undefined);
  const syncEncoded = await fsp.readFile(syncFile, 'utf8');
  const syncEnvelope = JSON.parse(syncEncoded);
  const nativeProtectedData = Buffer.from(syncEnvelope.protectedData, 'base64');
  for (const forbidden of ['Local ficticio', 'Remoto ficticio', 'sync-smoke.example']) {
    assert.ok(!syncEncoded.includes(forbidden));
    assert.ok(!nativeProtectedData.includes(Buffer.from(forbidden)));
  }
  assert.deepEqual(await new BrowserSyncConflictStore(syncFile).list(), [review]);
  check('diario de sync protege variantes con DPAPI real y conserva revisión al reabrir');
  const resolved = await syncStore.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'local' }], () => undefined);
  assert.equal(resolved.status, 'ready');
  assert.deepEqual(await new BrowserSyncConflictStore(syncFile).list(), [resolved]);
  check('decisión manual permanece en el diario nativo hasta commit confirmado');
  const decided = await fsp.readFile(syncFile, 'utf8');
  const tampered = JSON.parse(decided);
  const protectedBytes = Buffer.from(tampered.protectedData, 'base64');
  protectedBytes[Math.floor(protectedBytes.length / 2)] ^= 1;
  tampered.protectedData = protectedBytes.toString('base64');
  await fsp.writeFile(syncFile, JSON.stringify(tampered));
  await assert.rejects(syncStore.list());
  await fsp.writeFile(syncFile, decided);
  const foreign = path.join(sandbox, 'vault-other-profile', 'sync-conflicts.json');
  await fsp.mkdir(path.dirname(foreign), { recursive: true });
  await fsp.copyFile(syncFile, foreign);
  await assert.rejects(new BrowserSyncConflictStore(foreign).list());
  check('DPAPI rechaza alteración y el diario impide copiar revisión entre perfiles');

  report.status = 'passed';
  await fsp.writeFile(path.join(sandbox, 'vault.json'), JSON.stringify(report, null, 2));
  app.exit(0);
}).catch(async () => {
  // Nunca volcar aserciones que podrían contener el material de prueba.
  report.status = 'failed';
  await fsp.writeFile(path.join(sandbox, 'vault.json'), JSON.stringify(report, null, 2));
  console.error('[Smoke] Falló una comprobación de bóveda; no se imprime contenido.');
  app.exit(1);
});
