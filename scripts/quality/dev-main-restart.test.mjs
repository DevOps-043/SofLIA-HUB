import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMainProcessRestart } from '../../config/vite/dev-main-restart.mts';

function emit(restart, code, asset = 'icono') {
  restart.plugin.generateBundle({}, {
    'main.js': { type: 'chunk', code, fileName: 'main.js' },
    'recurso.bin': { type: 'asset', source: new TextEncoder().encode(asset), fileName: 'recurso.bin' },
  }, false);
}

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

test('Un rebuild idéntico no reinicia; cambios de código o assets sí', async () => {
  let starts = 0;
  const restart = createMainProcessRestart(async () => { starts++; });
  await assert.rejects(restart.startIfChanged(), /aún no está listo/);
  emit(restart, 'versión A');
  await restart.startIfChanged();
  emit(restart, 'versión A');
  await restart.startIfChanged();
  assert.equal(starts, 1);
  emit(restart, 'versión B');
  await restart.startIfChanged();
  emit(restart, 'versión B', 'icono nuevo');
  await restart.startIfChanged();
  assert.equal(starts, 3);
});

test('Solicitudes duplicadas comparten arranque; un cambio posterior espera', async () => {
  const first = deferred();
  let starts = 0;
  let active = 0;
  let peak = 0;
  const restart = createMainProcessRestart(async () => {
    starts++; active++; peak = Math.max(peak, active);
    if (starts === 1) await first.promise;
    active--;
  });
  emit(restart, 'A');
  const initial = restart.startIfChanged();
  assert.equal(restart.startIfChanged(), initial);
  await new Promise(resolve => setImmediate(resolve));
  emit(restart, 'B');
  const next = restart.startIfChanged();
  assert.equal(starts, 1);
  first.resolve();
  await Promise.all([initial, next]);
  assert.equal(starts, 2);
  assert.equal(peak, 1);
});

test('Un fallo no bloquea reintentar el mismo código ni el siguiente', async () => {
  let starts = 0;
  const failure = new Error('Fallo de arranque simulado');
  const restart = createMainProcessRestart(async () => { if (++starts === 1) throw failure; });
  emit(restart, 'A');
  await assert.rejects(restart.startIfChanged(), error => error === failure);
  await restart.startIfChanged();
  emit(restart, 'B');
  await restart.startIfChanged();
  assert.equal(starts, 3);
});

test('Si falla cambiar de versión, volver a la anterior solicita arranque real', async () => {
  let starts = 0;
  const restart = createMainProcessRestart(async () => {
    if (++starts === 2) throw new Error('Fallo después de cerrar el hijo anterior');
  });
  emit(restart, 'A');
  await restart.startIfChanged();
  emit(restart, 'B');
  await assert.rejects(restart.startIfChanged(), /cerrar el hijo/);
  emit(restart, 'A');
  await restart.startIfChanged();
  assert.equal(starts, 3);
});
