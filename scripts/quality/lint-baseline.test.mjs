import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';
import { assertAnalyzable, newLintMessages } from './lint-baseline.mjs';
const message = (ruleId, severity = 2) => ({ ruleId, severity, message: ruleId });

test('un error fatal nunca se acepta aunque esté también en HEAD', () => {
  const failed = { fatalErrorCount: 1, messages: [{ fatal: true, severity: 2, ruleId: null, message: 'parser' }] };
  assert.throws(() => newLintMessages(failed, failed), /parser/);
  assert.throws(() => newLintMessages({ messages: [] }, failed), /parser/);
});
test('la comparación sólo acepta cantidades históricas de cada regla y severidad', () => {
  const baseline = { messages: [message('tipos'), message('tipos'), message('hooks', 1)] };
  assert.deepEqual(newLintMessages({ messages: [message('tipos'), message('tipos'), message('tipos'), message('hooks', 2)] }, baseline), [message('tipos'), message('hooks', 2)]);
  assert.deepEqual(newLintMessages({ messages: [message('tipos')] }, baseline), []);
});
test('la configuración de ESLint no recorre worktrees y analiza TypeScript con raíz explícita', async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored('.worktrees/ejemplo/src/file.ts'), true);
  const [result] = await eslint.lintText('const valor: string = 1;', { filePath: 'src/prueba-de-lint.ts' });
  assertAnalyzable(result, 'fixture de TypeScript');
  const [invalid] = await eslint.lintText('const valor: =', { filePath: 'src/prueba-de-lint.ts' });
  assert.throws(() => assertAnalyzable(invalid, 'fixture inválido'), /parser/);
});
