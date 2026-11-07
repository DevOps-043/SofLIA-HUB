import { assertAnalyzable, newLintMessages } from './lint-baseline.mjs';
import { collectLintScope, readLintSource } from './lint-git-scope.mjs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

async function main() {
  const root = process.cwd();
  const scope = collectLintScope(root, process.env.HARNESS_BASE_REF || '');
  const { ESLint } = createRequire(join(root, 'package.json'))('eslint');
  const eslint = new ESLint({ cwd: root, overrideConfigFile: join(root, 'eslint.config.mjs'),
    overrideConfig: { linterOptions: { reportUnusedDisableDirectives: 'error' } } });
  const regressions = []; let reviewed = 0;
  for (const { file, baselines } of scope.files) {
    if (await eslint.isPathIgnored(join(root, file))) continue;
    const input = readLintSource(root, file); if (!input) continue;
    const [current] = await eslint.lintText(input.source, { filePath: input.absolute });
    assertAnalyzable(current, file); reviewed++;
    const introduced = new Set();
    for (const revision of baselines) {
      const source = scope.baseline(file, revision);
      const baseline = source === undefined ? { messages: [] } : (await eslint.lintText(source, { filePath: input.absolute }))[0];
      assertAnalyzable(baseline, 'base de ' + file);
      for (const message of newLintMessages(current, baseline)) introduced.add(message);
    }
    const messages = current.messages.filter(message => introduced.has(message));
    if (messages.length) regressions.push({ ...current, messages,
      errorCount: messages.filter(message => message.severity === 2).length,
      warningCount: messages.filter(message => message.severity === 1).length,
      fixableErrorCount: messages.filter(message => message.severity === 2 && message.fix).length,
      fixableWarningCount: messages.filter(message => message.severity === 1 && message.fix).length });
  }
  if (regressions.length) {
    console.error((await eslint.loadFormatter('stylish')).format(regressions));
    throw new Error('Lint incremental: se detectaron incidencias nuevas sobre las bases verificadas.');
  }
  console.log(reviewed ? `Lint incremental: ${reviewed} archivos revisados sin deuda nueva.`
    : 'Lint incremental: no hay fuentes TS/JS modificadas fuera de las exclusiones.');
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : 'No se pudo completar el lint incremental.'); process.exitCode = 1; }
