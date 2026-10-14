import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.resolve(process.env.LEARNING_CHECKOUT || path.join(root, '../../SofLIA-Learning/SofLIA-Learning'), 'apps/web/src/features/live');
for (const [file, target] of [['live-studio.contract.ts','live-studio.contract.ts'], ['live-studio-domain.ts','live-studio-domain.ts'], ['recordings/contract.ts','recordings.contract.ts']]) {
  const destination = path.join(root, 'src/shared', target);
  const content = (await readFile(path.join(source, file), 'utf8')).replace(/\r\n/g, '\n').replace(/(["'])\.\/recordings\/contract\1/g, '$1./recordings.contract$1');
  const expected = '// Generado desde Learning. Sincronizar con scripts/quality/sync-learning-studio.mjs.\n' + content;
  if (process.argv.includes('--check')) {
    if ((await readFile(destination, 'utf8')).replace(/\r\n/g, '\n') !== expected) throw new Error(`El contrato compartido no coincide con Learning: ${file}`);
  } else await writeFile(destination, expected, 'utf8');
}
