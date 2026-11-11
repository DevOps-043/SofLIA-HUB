import assert from 'node:assert/strict';
import test from 'node:test';
import { download } from '../python-runtime-download.mjs';

test('la descarga compartida rechaza protocolo inseguro y exceso de redirecciones antes de escribir', async () => {
  await assert.rejects(download('http://example.test/runtime', 'no-debe-crearse'), /no permitida/);
  await assert.rejects(download('https://example.test/runtime', 'no-debe-crearse', 6), /no permitida/);
});
