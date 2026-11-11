import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { executePythonTests } from './python-tools-test.mjs';

const probe = { status: 0, stdout: '[3,12,14]\n' };

test('contratos puros usan intérprete explícito y entorno sin configuración Python ajena', () => {
  const calls = [];
  const executable = path.resolve('QA con espacios/python.exe');
  const status = executePythonTests({ environment: { SOFLIA_TEST_PYTHON: executable, PATH: 'ruta', PYTHONPATH: 'ajeno', PYTHONHOME: 'ajeno', SECRETO_FICTICIO: 'no heredar' }, run(...args) { calls.push(args); return calls.length === 1 ? probe : { status: 0 }; } });
  assert.equal(status, 0);
  assert.equal(calls.length, 2);
  for (const [command, args, options] of calls) {
    assert.equal(command, executable);
    assert.equal(options.shell, false);
    assert.ok(args.includes('-I') && args.includes('-S') && args.includes('-B'));
    assert.equal(options.env.PYTHONPATH, undefined);
    assert.equal(options.env.PYTHONHOME, undefined);
    assert.equal(options.env.SECRETO_FICTICIO, undefined);
    assert.equal(options.env.PATH, 'ruta');
  }
  assert.ok(calls[1][1].at(-1).endsWith('run_tests.py'));
  assert.equal(calls[1][2].timeout, 120000);
});

test('formatos reutilizan runner con site-packages y plazo acotado', () => {
  const calls = [];
  executePythonTests({ args: ['--formats'], platform: 'linux', environment: {}, run(...args) { calls.push(args); return calls.length === 1 ? probe : { status: 0 }; } });
  assert.equal(calls[0][0], 'python3');
  assert.ok(!calls[1][1].includes('-S'));
  assert.equal(calls[1][1].at(-1), '--formats');
  assert.equal(calls[1][2].timeout, 180000);
});

test('Windows usa python y propaga código no cero del runner', () => {
  let count = 0;
  assert.equal(executePythonTests({ platform: 'win32', environment: {}, run(command) { assert.equal(command, 'python'); return ++count === 1 ? probe : { status: 7 }; } }), 7);
  assert.equal(count, 2);
});

test('argumentos desconocidos y override relativo fallan antes de ejecutar', () => {
  const run = () => { throw new Error('No debe ejecutarse.'); };
  for (const args of [['--skip'], ['--formats', '--formats'], ['--formats', 'ajeno']]) {
    assert.throws(() => executePythonTests({ args, run }), /Argumentos/);
  }
  assert.throws(() => executePythonTests({ environment: { SOFLIA_TEST_PYTHON: 'relativo/python' }, run }), /absoluta/);
});

test('intérprete ausente, incompatible o metadata inválida nunca omite la etapa', () => {
  for (const response of [{ status: 1 }, { error: new Error('ENOENT') }, { status: 0, stdout: '[3,11,9]' }, { status: 0, stdout: '[3,13,0]' }, { status: 0, stdout: 'null' }, { status: 0, stdout: '[3,12]' }, { status: 0, stdout: 'ajeno' }]) {
    let count = 0;
    assert.throws(() => executePythonTests({ environment: {}, run() { count++; return response; } }), /Python 3\.12/);
    assert.equal(count, 1);
  }
});

test('timeout o señal del runner no se convierten en éxito', () => {
  for (const response of [{ error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) }, { status: null, signal: 'SIGTERM' }, { status: undefined }]) {
    let count = 0;
    assert.throws(() => executePythonTests({ environment: {}, run() { return ++count === 1 ? probe : response; } }), /no terminaron/);
  }
});
