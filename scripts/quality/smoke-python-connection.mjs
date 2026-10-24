import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { sidecarEnvironment, smokeSidecar } from './smoke-python-sidecars.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
assert.ok(process.argv.length === 2 || process.argv.length === 4 && process.argv[2] === '--python', 'Sólo se admite --python con ejecutable de QA explícito.');
const python = process.argv[3] ?? path.join(root, 'python-runtime', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
assert.ok(path.isAbsolute(python), 'El runtime de QA debe ser una ruta absoluta.'); await fs.access(python);
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-python-connection-'));
await fs.writeFile(path.join(sandbox, 'package.json'), '{"type":"commonjs"}');
for (const name of ['ndjson', 'sidecar-connection']) {
  const source = await fs.readFile(path.join(root, 'electron/python', name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  await fs.writeFile(path.join(sandbox, name + '.js'), compiled.outputText);
}
const require = createRequire(path.join(sandbox, 'package.json'));
const { SidecarConnection } = require('./sidecar-connection.js');
const results = [];
for (const [directory, protocol] of [['sidecar', 4], ['tools_sidecar', 1]]) {
  const sidecar = path.join(root, 'python', directory, 'main.py');
  // Verifica el contrato Python y cierre normal sin el cliente main.
  const provider = await smokeSidecar(python, sidecar, protocol);
  const child = spawn(python, ['-I', '-B', '-u', '-X', 'utf8', sidecar], { windowsHide: true, cwd: path.dirname(sidecar), env: sidecarEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const connection = new SidecarConnection(child, { protocol, readyTimeoutMs: 5000, onMessage: () => {}, onClosed: () => {} });
  try {
    await connection.start(); const ping = await connection.request('ping', {}, 5000); const data = ping.data ?? ping;
    assert.equal(ping.ok, true); assert.equal(data.pong, true); assert.equal(data.protocol, protocol); assert.equal(typeof data.python, 'string');
    const unknown = await connection.request('comando_de_prueba_inexistente', {}, 5000); assert.equal(unknown.ok, false); assert.ok(unknown.error);
    results.push({ directory, protocol, python: data.python, provider, connectionPing: true, unknownCommandRejected: true });
  } finally {
    await connection.stop(); let timer;
    try { await Promise.race([closed, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('No se confirmó el cierre del hijo de QA.')), 5000); })]); }
    finally { clearTimeout(timer); }
  }
}
const report = { status: 'passed', python, sandbox, results, microphoneOpened: false, modelsLoaded: false, workspaceRuntimeUsed: process.argv.length === 2, qaRuntimeExplicit: process.argv.length === 4, applicationStarted: false };
await fs.writeFile(path.join(sandbox, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
