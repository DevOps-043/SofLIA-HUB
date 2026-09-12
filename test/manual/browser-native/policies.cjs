// Sólo perfiles ficticios; DPAPI real, sin bootstrap ni sesión personal.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const fsp = require('node:fs/promises'); const path = require('node:path');
const { app, safeStorage } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-') || phase !== 'policies' || process.versions.electron !== expectedVersion) app.exit(1);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, phase, name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
const load = name => require(path.join(sandbox, 'compiled/integrated-browser', name + '.js'));
const { BrowserSitePermissionStore } = load('site-permissions'); const { BrowserPrivacyStore } = load('privacy-store');
const { BrowserAgentPolicyStore } = load('agent-policy-store'); const { policyBackupPath } = load('policy-file-recovery');
const report = { status: 'running', electron: process.versions.electron, phase, checks: [], limitations: [] };
const check = text => { report.checks.push(text); console.log('[Smoke] OK: ' + text); };
void app.whenReady().then(async () => {
  assert.equal(safeStorage.isEncryptionAvailable(), true);
  const origin = 'https://privado.example';
  for (const kind of ['permissions', 'privacy', 'agent']) {
    const file = path.join(sandbox, phase, kind + '.json');
    const store = kind === 'permissions' ? new BrowserSitePermissionStore(file) : kind === 'privacy' ? new BrowserPrivacyStore(file) : new BrowserAgentPolicyStore(file);
    if (kind === 'permissions') { await store.set(origin, 'camera', 'granted'); await store.set(origin, 'camera', 'denied'); }
    if (kind === 'privacy') { await store.set({ origin, level: 'off', exceptionCategories: ['advertising'] }); await store.set({ origin, level: 'strict', exceptionCategories: [] }); }
    if (kind === 'agent') { await store.set({ origin, mode: 'balanced', decision: 'allow-always' }); await store.set({ origin, mode: 'strict', decision: 'block' }); }
    const backup = await fsp.readFile(policyBackupPath(file)); assert.equal(backup.includes(Buffer.from(origin)), false);
    assert.equal(JSON.parse(safeStorage.decryptString(backup)).scope, path.resolve(file));
    const broken = Buffer.from(backup); broken[broken.length - 1] ^= 1;
    await fsp.writeFile(file, '{ daño'); await fsp.writeFile(policyBackupPath(file), broken);
    await assert.rejects(store.prepareRecovery(() => {})); await fsp.writeFile(policyBackupPath(file), backup);
    check(kind + ': DPAPI protege la copia y rechaza alteración');
    const review = await store.prepareRecovery(() => {}); assert.equal(await fsp.readFile(file, 'utf8'), '{ daño'); await review.commit();
    if (kind === 'permissions') assert.equal(await new BrowserSitePermissionStore(file).resolve(origin, 'camera'), 'ask');
    if (kind === 'privacy') assert.equal((await new BrowserPrivacyStore(file).get(origin)).level, 'strict');
    if (kind === 'agent') assert.equal(await new BrowserAgentPolicyStore(file).evaluate(origin, 'observe-dom'), 'ask');
    assert.deepEqual(await fsp.readFile(policyBackupPath(file)), backup);
    const names = (await fsp.readdir(path.dirname(file))).filter(name => name.startsWith(path.basename(file) + '.damaged-'));
    assert.equal(names.length, 1); assert.equal((await fsp.readFile(path.join(path.dirname(file), names[0]))).includes(Buffer.from('{ daño')), false);
    if (kind === 'permissions') { await store.reset(origin); await assert.rejects(fsp.stat(policyBackupPath(file))); assert.equal((await fsp.readdir(path.dirname(file))).some(name => name.startsWith(path.basename(file) + '.damaged-')), false); }
    check(kind + ': reapertura restrictiva y original cifrado' + (kind === 'permissions' ? '; reset de permisos limpia copias' : ''));
  }
  const { BrowserAgentShortcutStore } = load('agent-shortcut-store'); const { BrowserSyncSettingsStore } = load('sync-settings-store');
  const shortcutPath = path.join(sandbox, phase, 'shortcuts.bin'); const shortcuts = new BrowserAgentShortcutStore(shortcutPath);
  const request = { action: 'save', profileRevision: 0, revision: 0, entry: { id: '', title: 'Atajo ficticio', instruction: 'Resume los fragmentos elegidos.', scope: 'selected-tabs', permission: 'read-fragments' } };
  const first = await shortcuts.run(request, () => {});
  await shortcuts.run({ ...request, revision: first.revision, entry: { ...first.entries[0], title: 'Otro nombre' } }, () => {});
  assert.equal((await fsp.readFile(policyBackupPath(shortcutPath))).includes(Buffer.from(request.entry.title)), false);
  await fsp.writeFile(shortcutPath, 'daño'); await (await shortcuts.prepareRecovery(() => {})).commit();
  const reopened = await new BrowserAgentShortcutStore(shortcutPath).run({ action: 'list', profileRevision: 0 }, () => {});
  assert.equal(reopened.entries[0].title, request.entry.title); assert.notEqual(reopened.entries[0].id, first.entries[0].id);
  assert.ok(reopened.revision > first.revision);
  check('atajos: recuperación y reapertura cifradas con DPAPI real, IDs nuevos sin ejecución');
  await shortcuts.run({ action: 'remove', profileRevision: 0, revision: reopened.revision, id: reopened.entries[0].id }, () => {});
  assert.equal(fs.existsSync(policyBackupPath(shortcutPath)), false);
  assert.equal((await fsp.readdir(path.dirname(shortcutPath))).some(name => name.startsWith('shortcuts.bin.damaged-')), false);
  check('atajos: eliminar retira las copias protegidas del perfil de prueba');
  const syncPath = path.join(sandbox, phase, 'sync-settings.json'); const settingsStore = new BrowserSyncSettingsStore(syncPath);
  const settings = { version: 1, ownerId: '11111111-1111-4111-8111-111111111111', origin: 'https://fixture.supabase.co', categories: ['bookmarks'], lastSyncedAt: null };
  await settingsStore.write(settings, () => {}); await settingsStore.write({ ...settings, lastSyncedAt: new Date().toISOString() }, () => {});
  assert.equal((await fsp.readFile(policyBackupPath(syncPath))).includes(Buffer.from(settings.ownerId)), false);
  await fsp.writeFile(syncPath, '{ daño'); await (await settingsStore.prepareRecovery(() => {})).commit();
  const restoredSettings = await new BrowserSyncSettingsStore(syncPath).read();
  assert.deepEqual(restoredSettings.categories, []); assert.equal(restoredSettings.lastSyncedAt, null);
  check('configuración sync: recuperación DPAPI y reapertura con transferencia desactivada, sin red');
  await settingsStore.write(restoredSettings, () => {});
  assert.equal(fs.existsSync(policyBackupPath(syncPath)), false);
  check('configuración sync: guardar pausa retira copias anteriores sin alterar claves o dispositivos');
  const { BrowserSemanticMemoryStore } = load('semantic-memory-store');
  const { semanticRecoveryPath } = load('semantic-memory-recovery');
  const semantic = new BrowserSemanticMemoryStore(); const semanticPath = path.join(sandbox, phase, 'semantic-memory.sqlite');
  semantic.path = () => semanticPath;
  semantic.write(semanticPath, { enabled: true, indexedAt: Date.now(), entries: [{ id: 'fixture', source: 'history', title: 'Fuente ficticia', url: 'https://example.com/', vector: Array.from({ length: 768 }, (_, index) => Number(index === 0)) }] }, () => {});
  const semanticBackup = fs.readFileSync(semanticRecoveryPath(semanticPath));
  assert.equal(semanticBackup.includes(Buffer.from('Fuente ficticia')), false);
  const damagedBackup = Buffer.from(semanticBackup); damagedBackup[damagedBackup.length - 1] ^= 1;
  fs.writeFileSync(semanticPath, 'índice dañado'); fs.writeFileSync(semanticRecoveryPath(semanticPath), damagedBackup);
  assert.throws(() => semantic.prepareRecovery(() => {}));
  fs.writeFileSync(semanticRecoveryPath(semanticPath), semanticBackup);
  await semantic.prepareRecovery(() => {}).commit();
  assert.deepEqual(new BrowserSemanticMemoryStore().read(semanticPath), { enabled: false, indexedAt: null, entries: [] });
  check('memoria SQLite: respaldo DPAPI, rechazo de alteración y reapertura vacía sin opt-in');
  const damagedSemantic = fs.readdirSync(path.dirname(semanticPath)).find(name => name.startsWith('semantic-memory.sqlite.damaged-'));
  assert.ok(damagedSemantic);
  const damagedContent = JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(path.dirname(semanticPath), damagedSemantic))));
  assert.equal(Buffer.from(damagedContent.data, 'base64').toString(), 'índice dañado');
  semantic.write(semanticPath, { enabled: false, indexedAt: null, entries: [] }, () => {});
  assert.equal(fs.existsSync(path.join(path.dirname(semanticPath), damagedSemantic)), false);
  check('memoria SQLite: original protegido; nueva escritura retira cuarentena sin tocar fuentes');
  const { BrowserHistoryStore } = load('browser-history-store'); const { BrowserAgentAuditStore } = load('agent-audit-store');
  const { sqliteBackupPath } = load('sqlite-store-recovery');
  for (const kind of ['history', 'audit']) {
    const file = path.join(sandbox, phase, kind + '.sqlite');
    const store = kind === 'history' ? new BrowserHistoryStore(file, null) : new BrowserAgentAuditStore(file);
    if (kind === 'history') { await store.record({ url: 'https://example.com/astronomia', title: 'Astronomía ficticia' }); await store.flushAndClose(); }
    else store.record({ traceId: '11111111-1111-4111-8111-111111111111', tabId: 'fixture', url: 'https://example.com', operation: 'dom', result: 'completed' });
    const backup = fs.readFileSync(sqliteBackupPath(file)); assert.equal(backup.includes(Buffer.from('example.com')), false);
    const altered = Buffer.from(backup); altered[altered.length - 1] ^= 1; fs.writeFileSync(file, 'base dañada'); fs.writeFileSync(sqliteBackupPath(file), altered);
    await assert.rejects(Promise.resolve().then(() => store.prepareRecovery(() => {})));
    fs.writeFileSync(sqliteBackupPath(file), backup); const review = await store.prepareRecovery(() => {}); assert.equal(review.count, 1); await review.commit();
    if (kind === 'history') assert.equal((await store.list({ query: 'astronomia' })).length, 1); else assert.equal(store.list().total, 1);
    check(kind + ': DPAPI protege snapshot SQLite, rechaza alteración y recupera datos/índice');
    await store.clear(); if (kind === 'history') await store.flushAndClose();
    assert.equal(fs.readdirSync(path.dirname(file)).some(name => name.startsWith(kind + '.sqlite.damaged-')), false);
    fs.writeFileSync(file, 'daño posterior al borrado'); const empty = await store.prepareRecovery(() => {}); assert.equal(empty.count, 0); await empty.commit();
    if (kind === 'history') { assert.equal((await store.list()).length, 0); await store.flushAndClose(); } else assert.equal(store.list().total, 0);
    check(kind + ': borrar invalida copias anteriores; otra recuperación no resucita datos');
  }
  report.status = 'passed'; await fsp.writeFile(path.join(sandbox, phase + '.json'), JSON.stringify(report, null, 2)); app.exit(0);
}).catch(async () => {
  report.status = 'failed'; await fsp.writeFile(path.join(sandbox, phase + '.json'), JSON.stringify(report, null, 2));
  console.error('[Smoke] Falló recuperación de políticas; se omite contenido.'); app.exit(1);
});
