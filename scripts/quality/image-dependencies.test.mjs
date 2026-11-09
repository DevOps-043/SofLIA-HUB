import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { peerContracts, jimpContracts, providerContracts } from '../../test/manual/image-dependencies/contracts.cjs';

test('peers de imágenes conservan la API del padre legado sin otro major', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(peerContracts(manifest.overrides).length, 3);
  assert.throws(() => peerContracts({}), /cierre declarado/);
});
test('Jimp de ambos consumidores conserva imágenes, operaciones y rechazo de entrada inválida', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-jimp-contract-'));
  assert.equal((await jimpContracts(directory)).length, 4);
});
test('proveedores nut-js conservan lectura, escritura, color y límites con datos ficticios', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-image-provider-'));
  assert.equal((await providerContracts(directory)).length, 3);
});
