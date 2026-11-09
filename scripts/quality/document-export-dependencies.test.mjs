import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runParserContracts, runDocumentContracts } from '../../test/manual/document-export/contracts.cjs';

test('transitivas documentales mantienen APIs y rechazan bounds/ICNS inválidos', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-document-parser-contract-'));
  assert.equal((await runParserContracts(directory)).length, 4);
});
test('exportadores reales conservan CF/UUID, imágenes y archivos Office', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-document-export-contract-'));
  assert.equal((await runDocumentContracts(directory)).length, 6);
});
