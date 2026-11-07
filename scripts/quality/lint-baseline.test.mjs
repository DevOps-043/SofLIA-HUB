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

test('un análisis ausente o sin mensajes no se convierte en baseline vacío', () => {
  assert.throws(() => assertAnalyzable(undefined, 'fuente'), /análisis completo/);
  assert.throws(() => assertAnalyzable({}, 'fuente'), /análisis completo/);
});

test('los contextos JS distinguen scripts, DOM y fuentes del renderer sin desactivar reglas', async () => {
  const eslint = new ESLint();
  for (const [filePath, code] of [
    ['scripts/quality/prueba.mjs', 'export const ruta = process.cwd();'],
    ['test/fixtures/prueba.cjs', 'module.exports = { ruta: process.cwd() };'],
    ['test/manual/browser-native/prueba.cjs', 'const window = {}; module.exports = () => window;'],
    ['test/manual/project-panel/smoke.mjs', 'export const leerDOM = () => document.body;'],
    ['src/prueba.js', 'export const ancho = window.innerWidth;'],
    ['src/prueba.jsx', 'export const Vista = () => <div />;'],
    ['src/prueba.mts', 'export const texto: string = "hola";'],
    ['src/prueba.cts', 'export const texto: string = "hola";'],
  ]) {
    const [result] = await eslint.lintText(code, { filePath }); assertAnalyzable(result, filePath);
    assert.deepEqual(result.messages, [], filePath);
  }
  const [foreign] = await eslint.lintText('module.exports = {};', { filePath: 'src/prueba.js' });
  assert.ok(foreign.messages.some(message => message.ruleId === 'no-undef'));
  const [nodeOnly] = await eslint.lintText('module.exports = () => document.body;', { filePath: 'test/fixtures/prueba.cjs' });
  assert.ok(nodeOnly.messages.some(message => message.ruleId === 'no-undef'));
  const [unused] = await eslint.lintText('const dato = 1;', { filePath: 'scripts/quality/prueba.mjs' });
  assert.ok(unused.messages.some(message => message.ruleId === '@typescript-eslint/no-unused-vars'));
});
