import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'ai-specs', 'skills');
const targets = ['.codex', '.claude', '.cursor', '.gemini'];
const checkOnly = process.argv.includes('--check');

function parseFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`Frontmatter ausente: ${file}`);
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) throw new Error(`name/description ausente: ${file}`);
  return { name, description };
}

function wrapperFor(target, skill) {
  const canonical = relative(join(root, target, 'skills', skill.name), join(sourceRoot, skill.name, 'SKILL.md')).replaceAll('\\', '/');
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n# Adaptador canónico\n\nLee completamente \`${canonical}\` y sigue esa fuente canónica. No mantengas lógica duplicada en este adaptador.\n`;
}

if (!existsSync(sourceRoot)) throw new Error('No existe ai-specs/skills');
const skills = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => parseFrontmatter(readFileSync(join(sourceRoot, entry.name, 'SKILL.md'), 'utf8'), entry.name));

const drift = [];
for (const target of targets) {
  for (const skill of skills) {
    const outputDir = join(root, target, 'skills', skill.name);
    const outputFile = join(outputDir, 'SKILL.md');
    const expected = wrapperFor(target, skill);
    if (checkOnly) {
      if (!existsSync(outputFile) || readFileSync(outputFile, 'utf8').replaceAll('\r\n', '\n') !== expected) {
        drift.push(relative(root, outputFile));
      }
      continue;
    }
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputFile, expected, 'utf8');
  }
}

if (drift.length) {
  console.error('Adaptadores ausentes o desactualizados:');
  drift.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(checkOnly ? `Adaptadores verificados: ${skills.length * targets.length}` : `Adaptadores sincronizados: ${skills.length * targets.length}`);
