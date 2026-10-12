import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { rolldown } from 'rolldown';

const require = createRequire(import.meta.url), root = process.cwd();
const output = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'production-smoke');
await fs.mkdir(output, { recursive: true });
const entry = path.join(output, 'smoke.cjs');
const build = await rolldown({ input: path.join(root, process.argv.includes('--preview-only') ? 'scripts/production-preview-entry.ts' : 'scripts/production-smoke-entry.ts'), external: id => id === 'electron' || id === 'sharp' || id === 'pptxgenjs' || id.startsWith('node:'), plugins: [{ name: 'native-absolute', resolveId(id) { if (['sharp', 'pptxgenjs'].includes(id)) return { id: require.resolve(id).replace(/\\/g, '/'), external: true }; } }] });
await build.write({ file: entry, format: 'cjs' }); await build.close();
const env = { ...process.env, SOFLIA_SMOKE_ROOT: root, SOFLIA_SMOKE_OUTPUT: output }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [entry], { env, windowsHide: true, stdio: 'inherit' });
const code = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', resolve); });
await fs.rm(entry, { force: true }); process.exitCode = code ?? 1;
