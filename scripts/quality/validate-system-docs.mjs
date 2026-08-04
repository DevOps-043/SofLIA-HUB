import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const errors = [];
const requiredDocs = [
  'docs/standards/engineering-practices.md',
  'docs/product/product-definition.md',
  'docs/product/stakeholders-and-actors.md',
  'docs/product/business-rules.md',
  'docs/product/functional-requirements.md',
  'docs/product/non-functional-requirements.md',
  'docs/product/user-stories.md',
  'docs/product/decisions-and-limits.md',
  'docs/product/traceability-matrix.md',
  'docs/architecture/technology-stack.md',
  'docs/architecture/frontend.md',
  'docs/architecture/backend-electron.md',
  'docs/architecture/ipc-and-integrations.md',
  'docs/architecture/agents-and-automation.md',
  'docs/architecture/runtime-parameters.md',
  'docs/data/data-architecture.md',
  'docs/data/data-dictionary.md',
  'docs/ux/information-architecture.md',
  'docs/ux/design-system.md',
  'docs/ux/screen-catalog-and-flows.md',
  'docs/ux/accessibility.md',
  'docs/security/security-and-privacy.md',
  'docs/operations/configuration.md',
  'docs/operations/development-and-devops.md',
  'docs/operations/release-and-recovery.md',
  'docs/operations/harness-quickstart.md',
  'docs/quality/test-strategy-and-inventory.md',
  'docs/references/harness-sources.md',
];

const contents = new Map();
for (const file of requiredDocs) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    errors.push(`Falta documento de sistema: ${file}`);
    continue;
  }
  const content = readFileSync(absolute, 'utf8');
  contents.set(file, content);
  if (!/^Estado:\s*(vigente|en ejecucion local)\./m.test(content)) {
    errors.push(`Documento sin estado vigente explicito: ${file}`);
  }
  if (/\[TODO|\bTBD\b|POR DEFINIR/i.test(content)) {
    errors.push(`Documento conserva marcador pendiente: ${file}`);
  }
  const evidence = [...content.matchAll(/<!-- evidence:\s*([^>]+?)\s*-->/g)].map((match) => match[1].trim());
  if (!evidence.length) errors.push(`Documento sin evidencia declarada: ${file}`);
  for (const path of evidence) {
    if (!existsSync(join(root, path))) errors.push(`Evidencia inexistente en ${file}: ${path}`);
  }
}

const definitionDocs = [
  'docs/product/business-rules.md',
  'docs/product/functional-requirements.md',
  'docs/product/non-functional-requirements.md',
  'docs/product/user-stories.md',
  'docs/product/decisions-and-limits.md',
];
const definitions = new Map();
for (const file of definitionDocs) {
  const content = contents.get(file) || '';
  for (const match of content.matchAll(/<!-- define:\s*((?:BR|RF|RNF|HU|DEC|LIM)-\d{3})\s*-->/g)) {
    const id = match[1];
    if (definitions.has(id)) errors.push(`ID definido mas de una vez: ${id}`);
    definitions.set(id, file);
    const visibleOccurrences = content.match(new RegExp(`\\b${id}\\b`, 'g'))?.length || 0;
    if (visibleOccurrences < 2) errors.push(`ID definido sin entrada visible: ${id} en ${file}`);
  }
}

const expectedCounts = { BR: 28, RF: 39, RNF: 20, HU: 25, DEC: 14, LIM: 18 };
for (const [prefix, expected] of Object.entries(expectedCounts)) {
  const ids = [...definitions].filter(([id]) => id.startsWith(`${prefix}-`));
  if (ids.length !== expected) errors.push(`Cobertura ${prefix}: esperados ${expected}, encontrados ${ids.length}`);
  for (let index = 1; index <= expected; index += 1) {
    const id = `${prefix}-${String(index).padStart(3, '0')}`;
    if (!definitions.has(id)) errors.push(`Falta definicion ${id}`);
  }
}

const traceability = contents.get('docs/product/traceability-matrix.md') || '';
for (const id of definitions.keys()) {
  if (!traceability.includes(id)) errors.push(`ID sin trazabilidad: ${id}`);
}

const channelFiles = [1, 2, 3, 4, 5].map((group) => join(root, 'electron', 'preload', `channel-group-${group}.ts`));
const channelCount = channelFiles.reduce((total, file) => {
  if (!existsSync(file)) return total;
  return total + [...readFileSync(file, 'utf8').matchAll(/^\s*'[^']+',?\s*$/gm)].length;
}, 0);
const ipcDoc = contents.get('docs/architecture/ipc-and-integrations.md') || '';
if (!ipcDoc.includes(`contiene ${channelCount} canales`)) {
  errors.push(`El catalogo IPC no coincide con ${channelCount} canales derivados`);
}

let tracked = [];
try {
  const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  tracked = [...new Set([...versioned, ...untracked])];
} catch (error) {
  errors.push(`No se pudo derivar inventario Git: ${error.message}`);
}
const tests = tracked.filter((file) => /(__tests__\/.*|\.(test|spec)\.)/.test(file));
const mainTests = tests.filter((file) => file.startsWith('electron/')).length;
const rendererTests = tests.filter((file) => file.startsWith('src/')).length;
const qualityDoc = contents.get('docs/quality/test-strategy-and-inventory.md') || '';
const expectedInventory = `contiene ${tests.length} archivos de prueba: ${mainTests} para main y ${rendererTests}`;
if (!qualityDoc.includes(expectedInventory)) errors.push(`Inventario de pruebas desactualizado; esperado: ${expectedInventory}`);

const css = existsSync(join(root, 'src', 'index.css')) ? readFileSync(join(root, 'src', 'index.css'), 'utf8') : '';
const designDoc = contents.get('docs/ux/design-system.md') || '';
for (const token of ['#f9fafb', '#f0f2f5', '#ffffff', '#0a2540', '#0f1419', '#0a0d12', '#1e2329', '#9aa4af', '#00d4b3']) {
  if (!css.toLowerCase().includes(token) || !designDoc.toLowerCase().includes(token)) {
    errors.push(`Token de paleta no trazado entre CSS y documentacion: ${token}`);
  }
}

if (errors.length) {
  console.error('Validacion de documentacion de sistema fallida:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Documentacion de sistema valida: ${requiredDocs.length} documentos, ${definitions.size} IDs, ${channelCount} canales y ${tests.length} archivos de prueba.`);
