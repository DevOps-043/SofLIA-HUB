import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runZipContracts } from '../../test/manual/validation-onnx/contracts.cjs';

test('ZIP del instalador ONNX conserva extracción y acota metadatos/inflado con biblioteca real', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-onnx-zip-contract-'));
  const checks = await runZipContracts(directory);
  assert.equal(checks.length, 5);
});
