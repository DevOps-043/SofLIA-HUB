import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const root = process.cwd();
const files = [];
const errors = [];

function collect(path, { skipArchive = false } = {}) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) { if (path.endsWith('.md')) files.push(path); return; }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (skipArchive && entry.isDirectory() && entry.name === 'archive') continue;
    collect(join(path, entry.name), { skipArchive });
  }
}

['README.md', 'AGENTS.md', 'CLAUDE.md', 'codex.md'].forEach((file) => collect(join(root, file)));
collect(join(root, 'docs'), { skipArchive: true });
collect(join(root, 'ai-specs'));
collect(join(root, 'openspec'));

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const links = content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.split(/\s+["']/)[0].split('#')[0];
    if (!target || /^(https?:|mailto:|data:|#)/i.test(target) || /^[A-Za-z]:[\\/]/.test(target)) continue;
    if (target.includes('*') || target.includes('<') || target.includes('>')) continue;
    try { target = decodeURIComponent(target); } catch { /* conservar literal */ }
    const resolved = target.startsWith('/') ? join(root, target.slice(1)) : resolve(dirname(file), target);
    if (!existsSync(resolved)) errors.push(`${relative(root, file)} -> ${match[1]}`);
  }
}

if (errors.length) {
  console.error('Enlaces Markdown rotos:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Enlaces válidos en ${files.length} archivos Markdown activos.`);
