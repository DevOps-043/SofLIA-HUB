import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const metrics = ['lines', 'statements', 'functions', 'branches'];
const invalid = detail => { throw new Error(`Cobertura inválida: ${detail}.`); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function metric(value) {
  if (!record(value) || !['total', 'covered', 'skipped'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
    || value.covered > value.total || value.skipped > value.total || !Number.isFinite(value.pct) || value.pct < 0 || value.pct > 100) invalid('métrica malformada');
  const computed = value.total ? Math.floor(value.covered * 10000 / value.total) / 100 : 100;
  if (Math.abs(value.pct - computed) > 0.011) invalid('porcentaje inconsistente');
  return value;
}

/** Comprueba resultados completos, no sólo el porcentaje que declara un JSON. */
export function checkCoverage(summary, expectedFiles, thresholds, root) {
  if (!record(summary) || !record(summary.total) || !expectedFiles.length) invalid('reporte o inventario ausente');
  const expected = new Set(expectedFiles);
  if (expected.size !== expectedFiles.length) invalid('inventario duplicado');
  const actual = new Map();
  for (const [name, value] of Object.entries(summary)) {
    if (name === 'total') continue;
    const relative = path.relative(root, path.resolve(root, name)).split(path.sep).join('/');
    if (!expected.has(relative) || actual.has(relative) || !record(value)) invalid('fuente inesperada o duplicada');
    actual.set(relative, value);
  }
  if (actual.size !== expected.size) invalid('faltan fuentes de producción, incluso las no importadas');
  const result = {};
  for (const name of metrics) {
    const total = metric(summary.total[name]);
    const accumulated = { total: 0, covered: 0, skipped: 0 };
    for (const file of actual.values()) {
      const current = metric(file[name]);
      for (const key of Object.keys(accumulated)) accumulated[key] += current[key];
    }
    if (Object.keys(accumulated).some(key => accumulated[key] !== total[key]) || total.total === 0) invalid('totales globales inconsistentes');
    const floor = thresholds?.[name];
    if (!Number.isFinite(floor) || floor <= 0 || floor > 100) invalid('piso no verificable');
    if (total.pct < floor) invalid(`${name} ${total.pct}% por debajo de ${floor}%`);
    result[name] = total.pct;
  }
  return { files: actual.size, ...result };
}

export function productionFiles(root) {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  return [...new Set(listed.split('\0'))].filter(file => /^(src|electron)\/.+\.tsx?$/.test(file)
    && !file.includes('/__tests__/') && !file.endsWith('.d.ts') && fs.existsSync(path.join(root, file)))
    .map(file => { if (!fs.lstatSync(path.join(root, file)).isFile()) invalid('fuente no regular'); return file; }).sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) invalid('argumentos extra');
    const root = process.cwd();
    const policy = JSON.parse(fs.readFileSync(path.join(root, 'config/coverage-policy.json'), 'utf8'));
    const summary = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'coverage/coverage-summary.json'), 'utf8'));
    const result = checkCoverage(summary, productionFiles(root), policy.thresholds, root);
    console.log(`Cobertura verificada en ${result.files} fuentes productivas: líneas ${result.lines}%, sentencias ${result.statements}%, funciones ${result.functions}%, ramas ${result.branches}%.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo verificar cobertura.');
    process.exitCode = 1;
  }
}
