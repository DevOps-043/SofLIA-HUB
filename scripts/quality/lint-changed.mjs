import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runGit = (args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).split(/\r?\n/).filter(Boolean);
const files = new Set();

function addGitFiles(args) {
  try { runGit(args).forEach((file) => files.add(file)); } catch { /* referencia opcional */ }
}

const statusDirty = runGit(['status', '--porcelain']).length > 0;
const base = process.env.HARNESS_BASE_REF || (!statusDirty ? 'HEAD~1' : '');
if (base) addGitFiles(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
addGitFiles(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
addGitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
addGitFiles(['ls-files', '--others', '--exclude-standard']);

const lintable = [...files].filter((file) => /\.(ts|tsx)$/.test(file) && existsSync(join(root, file)));
if (!lintable.length) {
  console.log('Lint incremental: no hay archivos TypeScript modificados.');
  process.exit(0);
}

const executable = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [executable, ...lintable, '--report-unused-disable-directives', '--max-warnings', '0'], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
