import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as checker from './check-electron-stability.mjs';
import { isPrerelease, validateElectronRelease } from './check-electron-stability.mjs';

assert.equal(isPrerelease('43.4.0'), false);
assert.equal(isPrerelease('44.0.0-beta.3'), true);
// Estabilidad es una política separada; el checkout exige además seguridad.
assert.equal(validateElectronRelease({ version: '43.4.0' }).valid, true);
for (const version of [undefined, null, '', '^43.4.0', '*', 'latest', '43.4', 'texto']) assert.equal(validateElectronRelease({ version }).valid, false);
assert.equal(validateElectronRelease({ version: '44.0.0-beta.3', exception: null }).valid, false);
assert.equal(validateElectronRelease({
  version: '44.0.0-beta.3',
  now: new Date('2026-09-04T00:00:00Z'),
  exception: { version: '44.0.0-beta.3', expiresAt: '2026-09-30T00:00:00Z', risk: 'Compatibilidad web', rollback: 'Volver a 43.4.0' },
}).valid, true);

test('la política de seguridad rechaza versiones afectadas aunque sean estables', () => {
  for (const version of ['41.9.9', '42.11.15', '43.0.0-beta.1', '43.8.0', '44.5.1', '44.9.0', '45.0.0-beta.5']) {
    assert.equal(checker.validateElectronSecurity(version).valid, false, version);
  }
});

test('la política admite los límites parcheados publicados y releases posteriores', () => {
  for (const version of ['42.11.16', '43.8.1', '44.9.1', '44.9.3', '45.0.0-beta.6', '45.0.0']) {
    assert.equal(checker.validateElectronSecurity(version).valid, true, version);
  }
});

test('metadata ausente, rangos, ceros iniciales y versiones no canónicas fallan cerrado', () => {
  for (const version of [undefined, null, 44, '', '^44.9.3', 'v44.9.3', '44.09.3', '44.9.3 ', '44.9', '44.9.3.0']) {
    assert.equal(checker.validateElectronSecurity(version).valid, false, String(version));
  }
});

test('una excepción de prerelease no permite validar una versión afectada', () => {
  const candidate = { version: '45.0.0-beta.5', now: new Date('2026-10-24T00:00:00Z'),
    exception: { version: '45.0.0-beta.5', expiresAt: '2026-11-01T00:00:00Z', risk: 'Prueba ficticia', rollback: '44.9.3' } };
  assert.equal(checker.validateElectronRelease(candidate).valid, true);
  assert.equal(checker.validateElectronCheckout(candidate).valid, false);
  candidate.version = candidate.exception.version = '45.0.0-beta.6';
  assert.equal(checker.validateElectronCheckout(candidate).valid, true);
});

test('la CLI rechaza lock, paquete o ejecutable divergentes en checkouts ficticios', () => {
  const require = createRequire(import.meta.url);
  const semverRoot = path.dirname(require.resolve('semver/package.json'));
  for (const mismatch of ['lock', 'package', 'executable']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-electron-guard-'));
    const packageRoot = path.join(root, 'node_modules/electron');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.symlinkSync(semverRoot, path.join(root, 'node_modules/semver'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.copyFileSync(new URL('./check-electron-stability.mjs', import.meta.url), path.join(root, 'checker.mjs'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { electron: '44.9.3' } }));
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/electron': { version: mismatch === 'lock' ? '44.5.1' : '44.9.3' } } }));
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ version: mismatch === 'package' ? '44.5.1' : '44.9.3', main: 'index.cjs' }));
    const marker = path.join(root, 'executable-requested');
    fs.writeFileSync(path.join(packageRoot, 'index.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'invocado');module.exports=${JSON.stringify(process.execPath)};`);
    // El binario Node real no devuelve process.versions.electron: debe fallar.
    const result = spawnSync(process.execPath, [path.join(root, 'checker.mjs')], { cwd: root,
      env: {}, encoding: 'utf8', windowsHide: true, shell: false, timeout: 15000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, mismatch === 'executable' ? /ejecutable instalado no acredita/ : /no coinciden/);
    assert.equal(fs.existsSync(marker), mismatch === 'executable');
    // Conservar evidencia temporal; nunca recorrer/eliminar la junction semver.
  }
});
