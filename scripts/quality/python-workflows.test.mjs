import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const workflow = name => parse(read('.github/workflows/' + name));

test('gate incluye contratos Python obligatorios y scripts apuntan al wrapper compartido', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['python-tools:test'], 'node scripts/quality/python-tools-test.mjs');
  assert.equal(scripts['python-tools:test:formats'], 'node scripts/quality/python-tools-test.mjs --formats');
  assert.match(read('scripts/quality/run-gate.mjs'), /'python-tools:test'/);
});

test('CI y verificación de release configuran Python antes del gate y llaman a la matriz', () => {
  for (const file of ['ci.yml', 'release.yml']) {
    const config = workflow(file);
    const steps = config.jobs.verify.steps;
    const python = steps.findIndex(step => step.run === 'node scripts/quality/prepare-test-python.mjs --github-actions');
    const gate = steps.findIndex(step => step.run === 'npm run verify:pr');
    assert.ok(python >= 0 && python < gate);
    assert.doesNotMatch(JSON.stringify(steps), /actions\/setup-python/);
    assert.equal(config.jobs['python-readers'].uses, './.github/workflows/python-readers.yml');
    assert.equal(config.jobs['python-readers'].secrets, undefined);
  }
});

test('todos los builds de release esperan la verificación Python del mismo checkout', () => {
  const jobs = workflow('release.yml').jobs;
  for (const name of ['build-windows', 'build-mac', 'build-linux']) {
    assert.ok(jobs[name].needs.includes('verify'));
    assert.ok(jobs[name].needs.includes('python-readers'));
  }
});

test('matriz reutilizable verifica cuatro arquitecturas, locks y permisos limitados', () => {
  const config = workflow('python-readers.yml');
  assert.equal(config.permissions.contents, 'read');
  assert.ok(Object.hasOwn(config.on, 'workflow_call'));
  assert.equal(config.on.pull_request_target, undefined);
  const job = config.jobs.formats;
  assert.equal(job['timeout-minutes'], 15);
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(job.strategy.matrix.include.map(item => item.target).sort(), ['darwin-arm64', 'linux-arm64', 'linux-x64', 'win32-x64']);
  assert.deepEqual(job.strategy.matrix.include.map(item => item.runner).sort(), ['macos-15', 'ubuntu-24.04', 'ubuntu-24.04-arm', 'windows-2025']);
  for (const step of job.steps.filter(item => item.uses)) assert.match(step.uses, /@[0-9a-f]{40}$/);
  const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with['persist-credentials'], false);
  const scripts = job.steps.map(step => step.run ?? '').join('\n');
  assert.match(scripts, /--require-hashes/);
  assert.match(scripts, /--only-binary=:all:/);
  assert.match(scripts, /python\/bootstrap\.lock/);
  assert.match(scripts, /python\/tools_sidecar\/requirements\.txt/);
  assert.match(scripts, /pip --isolated check/);
  assert.match(scripts, /run_tests\.py --formats/);
  assert.match(scripts, /platform\.machine/);
  assert.match(scripts, /3, 12, 11/);
  assert.doesNotMatch(scripts, /secrets\.|python\/requirements\.txt|model.*download|--no-verify/);
});

test('candidato Intel usa preparador verificado y conserva sus módulos en checkout limitado', () => {
  const config = workflow('python-reader-native.yml');
  const steps = config.jobs['macos-intel'].steps;
  const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'));
  for (const file of ['scripts/quality/prepare-test-python.mjs', 'scripts/python-runtime-support.cjs', 'scripts/python-runtime-download.mjs']) {
    assert.ok(checkout.with['sparse-checkout'].includes('/' + file));
  }
  assert.ok(steps.some(step => step.run === 'node scripts/quality/prepare-test-python.mjs --github-actions'));
  assert.doesNotMatch(JSON.stringify(steps), /actions\/setup-python/);
});
