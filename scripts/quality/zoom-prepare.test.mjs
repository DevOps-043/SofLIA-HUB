import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isZoomRuntimePrepared } from '../ensure-zoom-runtime.mjs';

test('Zoom reutiliza locks coherentes y rechaza instalación incompleta o divergente', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'soflia-zoom-prepare-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (name, value) => writeFileSync(path.join(directory, name), JSON.stringify(value));
  const dependencies = { '@zoom/meetingsdk': '1.0.0', '@zoom/videosdk': '2.0.0' };
  const packages = {};
  for (const [name, version] of Object.entries(dependencies)) {
    const key = `node_modules/${name}`;
    mkdirSync(path.join(directory, key, name.endsWith('videosdk') ? 'dist/lib' : 'dist'), { recursive: true });
    write(`${key}/package.json`, { version });
    packages[key] = { version, resolved: `https://example.invalid/${name}`, integrity: 'sha512-ficticio' };
  }
  write('package.json', { dependencies });
  write('package-lock.json', { packages: { '': { dependencies }, ...packages } });
  write('node_modules/.package-lock.json', { packages });
  assert.equal(isZoomRuntimePrepared(directory), true);
  write('node_modules/@zoom/videosdk/package.json', { version: '3.0.0' });
  assert.equal(isZoomRuntimePrepared(directory), false);
  write('node_modules/@zoom/videosdk/package.json', { version: '2.0.0' });
  write('package.json', { dependencies: { ...dependencies, react: '18.3.1' } });
  assert.equal(isZoomRuntimePrepared(directory), false);
  write('package.json', { dependencies });
  rmSync(path.join(directory, 'node_modules/@zoom/videosdk/package.json'));
  assert.equal(isZoomRuntimePrepared(directory), false);
  write('node_modules/.package-lock.json', {});
  assert.equal(isZoomRuntimePrepared(directory), false);
});
