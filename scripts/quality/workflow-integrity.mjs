import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function immutableReference(value) {
  if (typeof value !== 'string' || value.includes('${{') || /\s|\\/.test(value)) return false;
  if (value.startsWith('./')) return value.slice(2).split('/').every(part => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..');
  if (value.startsWith('docker://')) return /^docker:\/\/[^@\s]+@sha256:[a-f\d]{64}$/i.test(value);
  return /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[a-f\d]{40}$/i.test(value)
    && value.split('@')[0].split('/').every(part => part !== '.' && part !== '..');
}

/** Sólo describe ubicaciones; nunca registra valores de env o secretos del YAML. */
export function workflowReferences(source, label, composite = false) {
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) throw new Error(`${label}: YAML demasiado grande.`);
  const doc = parseDocument(source, { uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length) throw new Error(`${label}: YAML inválido.`);
  let data;
  try { data = doc.toJS({ maxAliasCount: 50 }); } catch { throw new Error(`${label}: YAML no admitido.`); }
  if (!record(data)) throw new Error(`${label}: estructura inválida.`);
  const references = [];
  const add = (value, location) => references.push({ file: label, location, value, valid: immutableReference(value) });
  const steps = (value, location) => {
    if (!Array.isArray(value)) throw new Error(`${label}: pasos inválidos.`);
    for (let index = 0; index < value.length; index++) {
      const step = value[index];
      if (!record(step)) throw new Error(`${label}: paso inválido.`);
      if (Object.hasOwn(step, 'uses')) add(step.uses, `${location}[${index}].uses`);
    }
  };
  if (composite) {
    if (!record(data.runs)) throw new Error(`${label}: action sin runs.`);
    if (data.runs.using === 'composite') steps(data.runs.steps, 'runs.steps');
  } else {
    if (!record(data.jobs)) throw new Error(`${label}: workflow sin jobs.`);
    for (const [name, job] of Object.entries(data.jobs)) {
      if (!record(job)) throw new Error(`${label}: job inválido.`);
      if (Object.hasOwn(job, 'uses')) add(job.uses, `jobs.${name}.uses`);
      if (Object.hasOwn(job, 'steps')) steps(job.steps, `jobs.${name}.steps`);
    }
  }
  return references;
}

export function checkWorkflowIntegrity(root) {
  const references = [];
  const visited = new Set();
  let workflows = 0;
  const contained = file => {
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Referencia local fuera del repositorio.');
    let current = root;
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('No se admiten enlaces en referencias locales.');
    }
    return file;
  };
  const inspect = (file, composite) => {
    if (visited.has(file)) return;
    contained(file); visited.add(file);
    const label = path.relative(root, file).split(path.sep).join('/');
    references.push(...workflowReferences(fs.readFileSync(file, 'utf8'), label, composite));
  };
  const walk = (directory, composite) => {
    if (!fs.existsSync(directory)) return;
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('No se admiten enlaces en la política de workflows.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('No se admiten enlaces en la política de workflows.');
      if (entry.isDirectory()) walk(file, composite);
      else if (/\.ya?ml$/i.test(entry.name) && (!composite || /^action\.ya?ml$/i.test(entry.name))) {
        if (!composite) workflows++;
        inspect(file, composite);
      }
    }
  };
  walk(path.join(root, '.github/workflows'), false);
  walk(path.join(root, '.github/actions'), true);
  if (!workflows) throw new Error('No hay workflows para comprobar.');
  // Una action local fuera de .github/actions también puede usar dependencias remotas.
  for (let index = 0; index < references.length; index++) {
    const reference = references[index];
    if (!reference.valid || !reference.value.startsWith('./')) continue;
    const target = contained(path.resolve(root, reference.value));
    if (fs.statSync(target).isDirectory()) {
      const manifest = ['action.yml', 'action.yaml'].map(name => path.join(target, name)).find(file => fs.existsSync(file));
      if (!manifest) throw new Error('Action local sin manifiesto verificable.');
      inspect(manifest, true);
    } else {
      if (!reference.value.startsWith('./.github/workflows/')) throw new Error('Workflow local fuera de su directorio.');
      inspect(target, false);
    }
  }
  const invalid = references.filter(reference => !reference.valid);
  if (invalid.length) throw new Error(invalid.map(reference => `${reference.file}: ${reference.location} requiere SHA completo, ruta local contenida o digest Docker.`).join('\n'));
  return { workflows, references: references.length, remote: references.filter(reference => !reference.value.startsWith('./')).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkWorkflowIntegrity(process.cwd());
    console.log(`Integridad CI verificada: ${result.workflows} workflows, ${result.references} referencias (${result.remote} remotas) inmutables o locales.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo verificar integridad CI.');
    process.exitCode = 1;
  }
}
