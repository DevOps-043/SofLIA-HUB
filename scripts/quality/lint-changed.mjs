import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
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

const requireFromWorkspace = createRequire(join(root, 'package.json'));
const { ESLint } = requireFromWorkspace('eslint');
// ESLint 10 movio `reportUnusedDisableDirectives` dentro de `linterOptions`.
const eslint = new ESLint({
  cwd: root,
  errorOnUnmatchedPattern: false,
  overrideConfig: { linterOptions: { reportUnusedDisableDirectives: 'error' } },
});
const currentResults = await eslint.lintFiles(lintable);
const regressions = [];

for (const current of currentResults) {
  const file = current.filePath.slice(root.length + 1).replaceAll('\\', '/');
  let baselineMessages = [];
  try {
    const source = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    baselineMessages = (await eslint.lintText(source, { filePath: current.filePath }))[0]?.messages ?? [];
  } catch { /* archivo nuevo: baseline limpio */ }

  const baselineCounts = countByRule(baselineMessages);
  const currentCounts = countByRule(current.messages);
  const messages = [];
  for (const [rule, count] of currentCounts) {
    const extra = count - (baselineCounts.get(rule) ?? 0);
    if (extra <= 0) continue;
    messages.push(...current.messages.filter((message) => ruleKey(message) === rule).slice(-extra));
  }
  if (messages.length) regressions.push({ ...current, messages, errorCount: messages.filter((message) => message.severity === 2).length, warningCount: messages.filter((message) => message.severity === 1).length });
}

if (regressions.length) {
  const formatter = await eslint.loadFormatter('stylish');
  console.error(formatter.format(regressions));
  console.error('Lint incremental: se detectaron incidencias nuevas sobre la linea base de HEAD.');
  process.exit(1);
}

console.log(`Lint incremental: ${lintable.length} archivos revisados sin deuda nueva.`);

function countByRule(messages) {
  const counts = new Map();
  for (const message of messages) {
    const key = ruleKey(message);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function ruleKey(message) {
  return `${message.severity}:${message.ruleId ?? message.message}`;
}
