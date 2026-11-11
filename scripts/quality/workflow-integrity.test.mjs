import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { immutableReference, workflowReferences, checkWorkflowIntegrity } from './workflow-integrity.mjs';

const sha = 'a'.repeat(40);
const yaml = reference => `name: QA\non: push\njobs:\n  verify:\n    steps:\n      - uses: '${reference}'\n`;

test('rechaza tags, ramas, referencias dinámicas y rutas escapadas', () => {
  for (const value of ['actions/checkout@v4', 'actions/checkout@main', 'actions/checkout@' + 'a'.repeat(39), '${{ matrix.action }}', './a/../secreto', '../externo', './a\\b', 'docker://node:24', null, 42]) assert.equal(immutableReference(value), false);
});
test('acepta SHA completo, acciones en subdirectorio, rutas locales y digest Docker', () => {
  for (const value of ['actions/checkout@' + sha, 'owner/repo/path/to/action@' + sha, './.github/workflows/reader.yml', './.github/actions/quality', 'docker://node@sha256:' + 'b'.repeat(64)]) assert.equal(immutableReference(value), true);
});
test('inspecciona pasos, jobs reutilizables y actions compuestas', () => {
  assert.equal(workflowReferences(yaml('actions/checkout@v4'), 'qa.yml')[0].valid, false);
  assert.equal(workflowReferences(`jobs:\n  reuse:\n    uses: owner/repo/.github/workflows/qa.yml@${sha}`, 'reuse.yml')[0].valid, true);
  assert.equal(workflowReferences('runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@v4', 'action.yml', true)[0].valid, false);
});
test('YAML inválido, aliases excesivos y uses no textual nunca aprueban por omisión', () => {
  for (const value of ['jobs: [', 'jobs: {}\njobs: {}', 'jobs: null', 'jobs:\n  verify:\n    steps: {}']) assert.throws(() => workflowReferences(value, 'qa.yml'));
  assert.equal(workflowReferences('jobs:\n  verify:\n    steps:\n      - uses: null', 'qa.yml')[0].valid, false);
  const aliases = ['a: &a [x, x, x, x, x]', 'b: &b [*a, *a, *a, *a, *a]', 'c: &c [*b, *b, *b, *b, *b]', 'jobs: {verify: {steps: *c}}'].join('\n');
  assert.throws(() => workflowReferences(aliases, 'qa.yml'));
});
test('todos los workflows reales fijan referencias remotas sin ejecutar Actions', () => {
  const result = checkWorkflowIntegrity(process.cwd());
  assert.equal(result.workflows, 6); assert.ok(result.references >= 31); assert.ok(result.remote >= 29);
});

test('una action local fuera de .github no permite esconder tags mutables', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-workflow-policy-'));
  try {
    fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
    fs.mkdirSync(path.join(root, 'actions/local'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github/workflows/qa.yml'), yaml('./actions/local'));
    const manifest = path.join(root, 'actions/local/action.yml');
    fs.writeFileSync(manifest, 'runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@v4');
    assert.throws(() => checkWorkflowIntegrity(root), /requiere SHA/);
    fs.writeFileSync(manifest, `runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@${sha}`);
    assert.equal(checkWorkflowIntegrity(root).remote, 1);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'soflia-workflow-policy-')));
    fs.rmSync(root, { recursive: true });
  }
});
