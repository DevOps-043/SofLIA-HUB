import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const required = [
  'AGENTS.md', 'CLAUDE.md', 'codex.md',
  'docs/README.md', 'docs/prompt_maestro.md', 'docs/standards/base.md',
  'docs/standards/engineering-practices.md',
  'docs/operations/harness-quickstart.md', 'docs/architecture/module-map.md',
  'ai-specs/README.md', 'ai-specs/agents/registry.yaml',
  'ai-specs/policies/tool-boundaries.md', 'ai-specs/policies/runtime-exposure.md',
  'openspec/config.yaml', 'database/README.md', 'resources/README.md',
  '.github/workflows/ci.yml', 'scripts/ai/sync-agent-adapters.mjs',
  'scripts/quality/check-doc-links.mjs', 'scripts/quality/lint-changed.mjs',
  '.agents/rules/soflia-harness.md',
  '.agents/workflows/openspec-propose.md',
  '.agents/workflows/openspec-apply.md',
  '.agents/workflows/openspec-verify.md',
  '.agents/workflows/openspec-archive.md',
];

for (const path of required) {
  if (!existsSync(join(root, path))) errors.push(`Falta ruta obligatoria: ${path}`);
}

for (const adapter of ['CLAUDE.md', 'codex.md']) {
  const path = join(root, adapter);
  if (existsSync(path) && !readFileSync(path, 'utf8').includes('AGENTS.md')) {
    errors.push(`${adapter} no apunta al router AGENTS.md`);
  }
}

const engineeringStandard = 'docs/standards/engineering-practices.md';
for (const [file, expectedReference] of [
  ['AGENTS.md', engineeringStandard],
  ['.agents/rules/soflia-harness.md', engineeringStandard],
  ['docs/prompt_maestro.md', engineeringStandard],
]) {
  const absolute = join(root, file);
  if (existsSync(absolute) && !readFileSync(absolute, 'utf8').includes(expectedReference)) {
    errors.push(`${file} no carga el estandar maestro: ${expectedReference}`);
  }
}

const engineeringPath = join(root, engineeringStandard);
if (existsSync(engineeringPath)) {
  const engineering = readFileSync(engineeringPath, 'utf8');
  for (let section = 1; section <= 17; section += 1) {
    if (!engineering.includes(`## ${section}.`)) {
      errors.push(`Estandar maestro sin area historica ${section}`);
    }
  }
}

function directoryHasFiles(path) {
  return readdirSync(path, { withFileTypes: true }).some((entry) => (
    entry.isFile() || (entry.isDirectory() && directoryHasFiles(join(path, entry.name)))
  ));
}

for (const retiredPath of ['GEMINI.md', '.gemini', '.cursor']) {
  const retired = join(root, retiredPath);
  const hasContent = existsSync(retired) && (!retiredPath.startsWith('.') || directoryHasFiles(retired));
  if (hasContent) {
    errors.push(`Adaptador retirado todavia presente: ${retiredPath}`);
  }
}

for (const antigravityDir of ['rules', 'workflows']) {
  const dir = join(root, '.agents', antigravityDir);
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir, { withFileTypes: true }).filter((item) => item.isFile() && item.name.endsWith('.md'))) {
    const file = join(dir, entry.name);
    if (readFileSync(file, 'utf8').length > 12_000) {
      errors.push(`Archivo Antigravity excede 12000 caracteres: ${relative(root, file)}`);
    }
  }
}

const skillsRoot = join(root, 'ai-specs', 'skills');
if (existsSync(skillsRoot)) {
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const skillFile = join(skillsRoot, entry.name, 'SKILL.md');
    const uiFile = join(skillsRoot, entry.name, 'agents', 'openai.yaml');
    if (!existsSync(skillFile)) { errors.push(`Skill sin SKILL.md: ${entry.name}`); continue; }
    if (!existsSync(uiFile)) errors.push(`Skill sin agents/openai.yaml: ${entry.name}`);
    const text = readFileSync(skillFile, 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) { errors.push(`Frontmatter inválido: ${relative(root, skillFile)}`); continue; }
    const keys = [...frontmatter[1].matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((match) => match[1]);
    if (keys.join(',') !== 'name,description') errors.push(`Frontmatter debe contener solo name y description: ${relative(root, skillFile)}`);
    if (!frontmatter[1].includes(`name: ${entry.name}`)) errors.push(`Nombre de skill no coincide: ${entry.name}`);
    if (text.includes('[TODO')) errors.push(`Skill conserva TODO: ${entry.name}`);
  }
} else {
  errors.push('Falta ai-specs/skills');
}

const registryPath = join(root, 'ai-specs', 'agents', 'registry.yaml');
if (existsSync(registryPath)) {
  const registry = readFileSync(registryPath, 'utf8');
  for (const source of [...registry.matchAll(/^\s*source:\s*(.+)$/gm)].map((match) => match[1].trim())) {
    if (!existsSync(join(root, 'ai-specs', 'agents', source))) errors.push(`Agente registrado sin fuente: ${source}`);
  }
  for (const list of [...registry.matchAll(/^\s*skills:\s*\[([^\]]*)\]/gm)].map((match) => match[1])) {
    for (const skill of list.split(',').map((name) => name.trim()).filter(Boolean)) {
      if (!existsSync(join(skillsRoot, skill, 'SKILL.md'))) errors.push(`Skill registrada inexistente: ${skill}`);
    }
  }
  const runtimeExposures = [...registry.matchAll(/^\s*development_skills_exposed:\s*(.+)$/gm)].map((match) => match[1].trim());
  if (!runtimeExposures.length || runtimeExposures.some((value) => value !== '[]')) {
    errors.push('Todo agente runtime debe declarar development_skills_exposed: []');
  }
}

const forbidden = [
  /(^|\/)__pycache__\//, /\.pyc$/i, /\.tsbuildinfo$/i,
  /(^|\/)tmp\//, /(^|\/)ts_errors\.txt$/i,
  /^\.claude\/settings\.local\.json$/i,
  /^(vite\.config|config\/vite\/[^/]+)\.(js|d\.ts)$/i,
  /(^|\/)main\.ts\.temp$/i, /(^|\/)(eng|spa)\.traineddata$/i,
  /^docs\/(?!archive\/).*\/source-files\//i,
  /^\.cursor\//i, /^\.gemini\//i, /^GEMINI\.md$/i,
];

try {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of tracked) {
    if (existsSync(join(root, file)) && forbidden.some((pattern) => pattern.test(file.replaceAll('\\', '/')))) {
      errors.push(`Artefacto prohibido versionado: ${file}`);
    }
  }
} catch (error) {
  errors.push(`No se pudo inspeccionar Git: ${error.message}`);
}

if (errors.length) {
  console.error('Validación del arnés fallida:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Arnés válido: ${required.length} rutas y ${readdirSync(skillsRoot).length} skills canónicas.`);
