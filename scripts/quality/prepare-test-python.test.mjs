import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { prepareTestPython } from './prepare-test-python.mjs';

test('un archivo descargado con hash incorrecto nunca se extrae ni ejecuta', async () => {
  let invoked = false;
  await assert.rejects(prepareTestPython({
    environment: { PYTHON_RUNTIME_URL: 'https://ajeno.test/python', PYTHON_RUNTIME_SHA256: '0'.repeat(64) },
    fetchArchive: async (url, destination) => { assert.ok(url.startsWith('https://github.com/astral-sh/python-build-standalone/')); fs.writeFileSync(destination, 'archivo ficticio'); },
    run() { invoked = true; throw new Error('No ejecutar.'); },
  }), /SHA256/);
  assert.equal(invoked, false);
});

test('target desconocido falla antes de descargar, sin aceptar overrides de entorno', async () => {
  let invoked = false;
  await assert.rejects(prepareTestPython({ platform: 'win32', arch: 'arm64',
    environment: { PYTHON_RUNTIME_URL: 'https://ajeno.test/python', PYTHON_RUNTIME_SHA256: '0'.repeat(64) },
    fetchArchive: async () => { invoked = true; },
  }), /no soportada/);
  assert.equal(invoked, false);
});
