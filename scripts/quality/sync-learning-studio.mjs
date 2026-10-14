import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.resolve(process.env.LEARNING_CHECKOUT || path.join(root, '../../SofLIA-Learning/SofLIA-Learning'), 'apps/web/src/features/live');
for (const file of ['live-studio.contract.ts', 'live-studio-domain.ts']) {
  const destination = path.join(root, 'src/shared', file);
  const expected = '// Generado desde Learning. Sincronizar con scripts/quality/sync-learning-studio.mjs.\n' + await readFile(path.join(source, file), 'utf8');
  if (process.argv.includes('--check')) {
    if (await readFile(destination, 'utf8') !== expected) throw new Error(`El contrato compartido no coincide con Learning: ${file}`);
  } else await writeFile(destination, expected, 'utf8');
}
