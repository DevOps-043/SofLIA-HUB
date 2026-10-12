import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronExecutable = require('electron');
const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'electron-resource-benchmark.cjs');

const baseline = await run('baseline');
const optimized = await run('optimized');
const report = {
  benchmark: 'runtime-resource-efficiency',
  measuredAt: new Date().toISOString(),
  baseline,
  optimized,
  reduction: {
    cpuPercent: reduction(baseline.cpuPercentAverage, optimized.cpuPercentAverage),
    workingSetMb: reduction(baseline.workingSetMbAverage, optimized.workingSetMbAverage),
    processCount: reduction(baseline.processCountAverage, optimized.processCountAverage),
  },
  limitations: [
    'Fixture sintético local; no representa todos los sitios ni el resto de servicios de Pulse Hub.',
    'El periodo de gracia de pestaña fría se acelera a 10 s; producción usa el valor documentado de 90 s.',
    'Los resultados dependen del equipo, versión de Electron y carga concurrente.',
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function run(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronExecutable, [scriptPath, `--mode=${mode}`], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Benchmark ${mode} excedió 35 segundos: ${stderr.trim()}`));
    }, 35_000);
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Benchmark ${mode} terminó con código ${code}: ${stderr.trim()}`));
        return;
      }
      const line = stdout.split(/\r?\n/).find((candidate) => candidate.startsWith('[BENCHMARK_RESULT]'));
      if (!line) {
        reject(new Error(`Benchmark ${mode} no produjo resultado: ${stderr.trim()}`));
        return;
      }
      resolve(JSON.parse(line.slice('[BENCHMARK_RESULT]'.length)));
    });
  });
}

function reduction(before, after) {
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) return null;
  return Math.round(((before - after) / before) * 10_000) / 100;
}
