const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/** Sólo fixtures del sandbox nativo; no cambia el reloj del sistema operativo. */
module.exports = async function exerciseRecoveryLifetime({ sandbox, load, check }) {
  const root = path.join(sandbox, 'policies', 'review-lifetime'); fs.mkdirSync(root);
  const guard = () => {};
  const { createRecoveryReviewLifetime } = load('recovery-review-lifetime');
  const first = process.hrtime.bigint(), last = process.hrtime.bigint();
  assert.ok(last >= first);
  const consent = createRecoveryReviewLifetime(); assert.equal(consent.consume(), true);
  assert.equal(consent.consume(), false); assert.equal(consent.expired(), false);
  check('revisión: Node/Electron aporta reloj de intervalo y consumo único');

  const expired = async (prepare, files) => {
    const realWall = Date.now, realMonotonic = process.hrtime.bigint;
    let wall = realWall(), monotonic = realMonotonic();
    Date.now = () => wall; process.hrtime.bigint = () => monotonic;
    try {
      const review = await prepare(); const original = files.map(file => fs.readFileSync(file));
      wall -= 3_600_000; monotonic += 300_001_000_000n;
      await assert.rejects(Promise.resolve().then(() => review.commit()));
      for (let index = 0; index < files.length; index++) assert.deepEqual(fs.readFileSync(files[index]), original[index]);
      await assert.rejects(Promise.resolve().then(() => review.commit()));
    } finally { Date.now = realWall; process.hrtime.bigint = realMonotonic; }
  };

  const { BrowserSitePermissionStore } = load('site-permissions');
  const permissionFile = path.join(root, 'permissions.json');
  const permissions = new BrowserSitePermissionStore(permissionFile), origin = 'https://fixture.example';
  await permissions.set(origin, 'camera', 'granted'); await permissions.set(origin, 'camera', 'denied');
  fs.writeFileSync(permissionFile, '{ daño');
  await expired(() => permissions.prepareRecovery(guard), [permissionFile, permissionFile + '.recovery.bin']);
  await (await permissions.prepareRecovery(guard)).commit();
  assert.equal(await permissions.resolve(origin, 'camera'), 'ask');
  check('revisión: DPAPI/políticas rechaza reloj atrasado y otra revisión recupera sin concesiones');

  const { BrowserHistoryStore } = load('browser-history-store');
  const historyFile = path.join(root, 'history.sqlite'), history = new BrowserHistoryStore(historyFile, null);
  await history.record({ url: 'https://fixture.example/tema', title: 'Tema ficticio' }); await history.flushAndClose();
  fs.writeFileSync(historyFile, 'base dañada');
  await expired(() => history.prepareRecovery(guard), [historyFile, historyFile + '.recovery.bin']);
  await (await history.prepareRecovery(guard)).commit();
  assert.equal((await history.list()).length, 1); await history.flushAndClose();
  check('revisión: SQLite rechaza reloj atrasado sin tocar principal/copia; revisión nueva recupera');

  const { BrowserSemanticMemoryStore } = load('semantic-memory-store');
  const semanticFile = path.join(root, 'memory.sqlite'), semantic = new BrowserSemanticMemoryStore();
  semantic.path = () => semanticFile;
  semantic.write(semanticFile, { enabled: true, indexedAt: Date.now(), entries: [{ id: 'fixture', source: 'history',
    title: 'Fuente propia', url: origin + '/', vector: Array.from({ length: 768 }, (_, index) => Number(index === 0)) }] }, guard);
  fs.writeFileSync(semanticFile, 'índice dañado');
  await expired(() => semantic.prepareRecovery(guard), [semanticFile, semanticFile + '.recovery.bin']);
  await semantic.prepareRecovery(guard).commit(); assert.equal(semantic.read(semanticFile).enabled, false);
  check('revisión: memoria semántica conserva archivos al vencer y otra revisión recupera desactivada');

  const { BrowserSyncSettingsStore } = load('sync-settings-store');
  const { BrowserSyncCheckpointStore } = load('sync-checkpoint-store');
  const { BrowserSyncConflictStore } = load('sync-conflict-store');
  const { prepareSyncStateRecovery } = load('sync-state-recovery');
  const { syncRecoveryMarker } = load('sync-recovery-guard');
  const syncRoot = path.join(root, 'sync'); fs.mkdirSync(syncRoot);
  const files = ['sync-settings.json', 'sync-checkpoints.json', 'sync-conflicts.json'].map(name => path.join(syncRoot, name));
  const settings = new BrowserSyncSettingsStore(files[0]), checkpoints = new BrowserSyncCheckpointStore(files[1]), conflicts = new BrowserSyncConflictStore(files[2]);
  const binding = { ownerId: '11111111-1111-4111-8111-111111111111', origin: 'https://fixture.supabase.co' };
  await settings.write({ version: 1, ...binding, categories: ['settings'], lastSyncedAt: null }, guard);
  const decision = await conflicts.prepare({ category: 'settings', baseRevision: 1, remoteRevision: 2,
    base: { theme: 'system' }, local: { theme: 'light' }, remote: { theme: 'dark' } }, guard);
  await checkpoints.write({ version: 1, ...binding, categories: { settings: { revision: 1,
    base: { theme: 'system' }, review: { id: decision.reviewId, local: { theme: 'light' } } } } }, guard);
  fs.writeFileSync(files[1], 'checkpoint dañado');
  await expired(() => prepareSyncStateRecovery(syncRoot, 'recover-state', guard), files);
  assert.equal(fs.existsSync(syncRecoveryMarker(syncRoot)), false);
  prepareSyncStateRecovery(syncRoot, 'recover-state', guard).commit();
  assert.deepEqual((await settings.read()).categories, []); assert.deepEqual((await checkpoints.read(binding)).categories, {});
  assert.deepEqual(await conflicts.list(), []);
  check('revisión: sync vencida no publica marcador; otra revisión restaura metadata pausada');

  const realWall = Date.now, realMonotonic = process.hrtime.bigint;
  let wall = realWall(); process.hrtime.bigint = () => 0n; Date.now = () => wall;
  try {
    const review = createRecoveryReviewLifetime(); wall += 300_000;
    assert.equal(review.expired(), true); wall -= 300_000;
    assert.equal(review.expired(), true); assert.equal(review.consume(), false);
  } finally { Date.now = realWall; process.hrtime.bigint = realMonotonic; }
  check('revisión: límite civil exacto observado no revive al corregir el reloj');
};
