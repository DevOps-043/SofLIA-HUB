/**
 * Compuerta de variables de build.
 *
 * Vite incrusta `import.meta.env.VITE_*` en tiempo de compilacion: una variable
 * ausente del `.env` del runner no falla el build, se convierte en cadena vacia
 * y viaja al instalador. Asi se publico 0.9.0 sin `VITE_OPENAI_API_KEY` y
 * SofLIA Pro/Max quedaron inutilizables en la version distribuida.
 *
 * Este script cierra ese hueco por dos lados:
 *
 *  1. Cobertura estatica: toda `VITE_*` que consumen `src/` o `electron/` debe
 *     escribirse en TODOS los bloques `.env` de release.yml. Corre en cualquier
 *     maquina, sin secretos.
 *  2. Valor efectivo: si existe un `.env` (el runner lo acaba de generar), las
 *     claves criticas no pueden estar vacias.
 *
 * Uso: `node scripts/quality/check-release-env.mjs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const WORKFLOW = join(root, '.github', 'workflows', 'release.yml');

/** Las inyecta el runtime (Vite dev server / proceso main), no el `.env`. */
const RUNTIME_INJECTED = new Set(['VITE_PUBLIC', 'VITE_DEV_SERVER_URL']);

/**
 * Sin estas el producto sale roto aunque el build termine en verde. El resto
 * puede ir vacio: apaga una integracion opcional, no el nucleo.
 */
const REQUIRED_NON_EMPTY = [
  'VITE_GEMINI_API_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SOFIA_SUPABASE_URL',
  'VITE_SOFIA_SUPABASE_ANON_KEY',
];

const errors = [];

function collectSourceFiles(path, out) {
  if (!existsSync(path)) return out;
  if (statSync(path).isFile()) {
    if (/\.tsx?$/.test(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === '__tests__')) continue;
    collectSourceFiles(join(path, entry.name), out);
  }
  return out;
}

// ── 1. Cobertura estatica ──────────────────────────────────────────────────
const used = new Set();
for (const file of [...collectSourceFiles(join(root, 'src'), []), ...collectSourceFiles(join(root, 'electron'), [])]) {
  for (const match of readFileSync(file, 'utf8').matchAll(/VITE_[A-Z0-9_]+/g)) {
    if (!RUNTIME_INJECTED.has(match[0])) used.add(match[0]);
  }
}

// Un bloque `.env` por job (windows, mac, linux). Se comparan por separado:
// el fallo original fue precisamente que los bloques divergieron entre si.
// El barrido es por lineas y no con un regex multilinea porque el workflow
// usa CRLF y cualquier `\n` literal dejaria de coincidir en silencio.
const workflowLines = readFileSync(WORKFLOW, 'utf8').split(/\r?\n/);
const envBlocks = [];
let current = null;
for (const line of workflowLines) {
  if (/^\s*- name: Create \.env file\s*$/.test(line)) {
    current = [];
    envBlocks.push(current);
    continue;
  }
  if (current && /^\s*- name: /.test(line)) current = null;
  if (current) current.push(line);
}

if (envBlocks.length === 0) {
  errors.push('No se encontro ningun paso "Create .env file" en release.yml.');
}

envBlocks.forEach((block, index) => {
  const written = new Set(
    [...block.join('\n').matchAll(/echo "(VITE_[A-Z0-9_]+)=/g)].map((match) => match[1]),
  );
  const missing = [...used].filter((name) => !written.has(name)).sort();
  if (missing.length > 0) {
    errors.push(
      `El bloque .env #${index + 1} de release.yml no escribe: ${missing.join(', ')}. ` +
      'Vite las incrustaria vacias en el instalador.',
    );
  }
});

// ── 2. Valor efectivo (solo cuando el .env ya existe) ──────────────────────
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  const values = new Map();
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  const empty = REQUIRED_NON_EMPTY.filter((name) => !values.get(name));
  if (empty.length > 0) {
    errors.push(
      `Claves criticas vacias o ausentes en .env: ${empty.join(', ')}. ` +
      'Revisa que el secret exista en Settings > Secrets and variables > Actions.',
    );
  }
} else {
  console.log('[release-env] Sin .env local: se omite la verificacion de valores.');
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}

console.log(`[release-env] OK: ${used.size} variables cubiertas en ${envBlocks.length} bloques .env.`);
