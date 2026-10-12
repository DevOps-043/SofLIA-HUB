import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { build as viteBuild } from 'vite';
import { rolldown } from 'rolldown';

const configRoot = process.cwd(), output = path.resolve(process.argv[2] ?? 'production-smoke/evaluacion-autonoma');
const require = createRequire(import.meta.url), runtimeRoot = fileURLToPath(new URL('../../', import.meta.url));
const selectedModel = process.argv.find(arg => arg.startsWith('--model='))?.slice(8);
await fs.mkdir(output, { recursive: true });
// El cliente usa la configuración existente en memoria: nunca persiste el bundle.
const built = await viteBuild({ configFile: false, root: configRoot, publicDir: false, logLevel: 'error', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, lib: { entry: path.join(runtimeRoot, 'scripts/evaluation/live-audiovisual-client.ts'), name: 'AudiovisualEval', formats: ['iife'] }, rolldownOptions: { output: { codeSplitting: false } } } });
const outputs = Array.isArray(built) ? built : [built];
const client = outputs.flatMap(item => item.output ?? []).find(item => item.type === 'chunk')?.code;
if (typeof client !== 'string' || Buffer.byteLength(client) > 4_000_000) throw new Error('No se pudo construir el cliente de evaluación en memoria.');
const entry = path.join(output, 'evaluation.cjs');
const bundle = await rolldown({ input: path.join(runtimeRoot, 'scripts/evaluation/live-audiovisual-entry.ts'), external: id => id === 'electron' || id.startsWith('node:'), plugins: [{ name: 'native-absolute', resolveId(id) { if (['sharp', 'pptxgenjs'].includes(id)) return { id: require.resolve(id).replace(/\\/g, '/'), external: true }; } }] });
try { await bundle.write({ file: entry, format: 'cjs' }); } finally { await bundle.close(); }
// Canal efímero de loopback autenticado: el código no aparece en argv ni disco.
const token = randomUUID();
const server = createServer((request, response) => {
  if (request.url !== '/' + token || request.method !== 'GET') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ client })); server.close();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = 'http://127.0.0.1:' + server.address().port + '/' + token;
const env = { ...process.env, SOFLIA_EVAL_SOURCE: runtimeRoot, SOFLIA_EVAL_CLIENT: endpoint, ...(selectedModel ? { SOFLIA_EVAL_MODEL: selectedModel } : {}) }; delete env.ELECTRON_RUN_AS_NODE;
let child;
const stop = () => { child?.kill(); server.close(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  child = spawn(require('electron'), [entry, output], { env, windowsHide: true, stdio: 'inherit' });
  process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', code => resolve(code ?? 1)); });
} finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); server.close(); }
