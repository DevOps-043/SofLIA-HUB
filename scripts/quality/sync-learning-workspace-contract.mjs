import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.resolve(root, '../../SofLIA-Learning/SofLIA-Learning/apps/web/src/features/live/workspace.contract.ts');
const destination = path.resolve(root, 'src/shared/learning-workspace.contract.ts');
const expected = '// Generado desde el contrato Learning. Sincronizar con scripts/quality/sync-learning-workspace-contract.mjs.\n' + await readFile(source, 'utf8');
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== expected) throw new Error('El contrato del aula no coincide con Learning.');
} else await writeFile(destination, expected, 'utf8');
