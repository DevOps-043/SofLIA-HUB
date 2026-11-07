import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
import { checkCoverage } from './check-coverage.mjs';

const root = process.cwd();
const metrics = ['lines', 'statements', 'functions', 'branches'];
const expected = ['src/a.ts', 'electron/b.ts'];
const floors = Object.fromEntries(metrics.map(name => [name, 50]));
const stats = (total, covered) => Object.fromEntries(metrics.map(name => [name, { total, covered, skipped: 0, pct: total ? Math.floor(covered * 10000 / total) / 100 : 100 }]));
const fixture = () => ({ total: stats(20, 10), [path.join(root, expected[0])]: stats(10, 10), [path.join(root, expected[1])]: stats(10, 0) });

test('cuenta toda producción, incluidos módulos sin ejecución', () => {
  assert.deepEqual(checkCoverage(fixture(), expected, floors, root), { files: 2, lines: 50, statements: 50, functions: 50, branches: 50 });
});
test('rechaza cobertura ausente, inventario vacío y fuentes omitidas o ajenas', () => {
  assert.throws(() => checkCoverage(null, expected, floors, root));
  assert.throws(() => checkCoverage(fixture(), [], floors, root));
  const missing = fixture(); delete missing[path.join(root, expected[1])];
  assert.throws(() => checkCoverage(missing, expected, floors, root), /faltan fuentes/);
  const extra = fixture(); extra[path.join(root, 'test/mock.ts')] = stats(0, 0);
  assert.throws(() => checkCoverage(extra, expected, floors, root), /inesperada/);
});
test('un total inventado o un porcentaje inconsistente no oculta un hueco', () => {
  const totals = fixture(); totals.total = stats(20, 20);
  assert.throws(() => checkCoverage(totals, expected, floors, root), /totales/);
  const pct = fixture(); pct.total.lines.pct = 100;
  assert.throws(() => checkCoverage(pct, expected, floors, root), /porcentaje/);
});
test('rechaza NaN, negativos, métricas imposibles y pisos ausentes o insuficientes', () => {
  for (const patch of [{ pct: NaN }, { total: -1 }, { covered: 21 }, { total: 0, covered: 0, pct: 100 }]) {
    const summary = fixture(); Object.assign(summary.total.lines, patch);
    assert.throws(() => checkCoverage(summary, expected, floors, root));
  }
  for (const floor of [0, NaN, undefined, 101, 51]) assert.throws(() => checkCoverage(fixture(), expected, { ...floors, lines: floor }, root));
});

test('el gate ejecuta una sola suite con cobertura y mantiene todas las métricas', () => {
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  assert.equal(scripts['test:coverage'], 'vitest run --coverage.enabled && node scripts/quality/check-coverage.mjs');
  const gate = fs.readFileSync('scripts/quality/run-gate.mjs', 'utf8');
  assert.match(gate, /'test:coverage'/); assert.doesNotMatch(gate, /'test',/);
  assert.match(gate, /'ci:integrity'/);
  const policy = JSON.parse(fs.readFileSync('config/coverage-policy.json', 'utf8'));
  assert.deepEqual(Object.keys(policy.thresholds).sort(), [...metrics].sort());
  assert.deepEqual(policy.exclude, ['**/__tests__/**', '**/*.d.ts', 'test/**']);
  assert.deepEqual(policy.include, ['src/**/*.{ts,tsx}', 'electron/**/*.ts']);
  assert.match(fs.readFileSync('vitest.config.ts', 'utf8'), /excludeAfterRemap: true/);
});
