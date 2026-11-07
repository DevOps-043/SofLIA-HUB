import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function collectLintScope(root, baseRef = '') {
  const git = (args, operation) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { throw new Error('No se pudo verificar Git: ' + operation + '.'); }
  };
  const records = value => value.split('\0').filter(Boolean);
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}'], 'HEAD').trim();
  const trees = new Map();
  const tree = revision => {
    if (!trees.has(revision)) {
      const entries = records(git(['ls-tree', '-r', '-z', revision], 'árbol de referencia')).map(record => {
        const tab = record.indexOf('\t'); const [mode, , blob] = record.slice(0, tab).split(' ');
        if (tab < 0 || !blob) throw new Error('Inventario Git inválido.');
        return [record.slice(tab + 1), { mode, blob }];
      });
      trees.set(revision, new Map(entries));
    }
    return trees.get(revision);
  };
  const paths = new Map();
  const add = (files, baseline) => {
    for (const file of files) {
      if (!/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(file)) continue;
      if (!paths.has(file)) paths.set(file, new Set()); paths.get(file).add(baseline);
    }
  };
  const diff = args => records(git(['diff', '--name-only', '-z', '--diff-filter=ACMR', ...args, '--'], 'selección de cambios'));
  const dirty = git(['status', '--porcelain', '-z'], 'estado del worktree').length > 0;
  if (baseRef) {
    const reference = git(['rev-parse', '--verify', '--end-of-options', baseRef + '^{commit}'], 'referencia configurada').trim();
    const bases = git(['merge-base', '--all', reference, head], 'ancestro común').trim().split(/\s+/).filter(Boolean);
    if (bases.length !== 1) throw new Error('No existe un único ancestro común verificable.');
    add(diff([bases[0], head]), bases[0]);
  } else if (!dirty) {
    const [, parent] = git(['rev-list', '--parents', '-n', '1', head], 'historia de HEAD').trim().split(/\s+/);
    if (parent) add(diff([parent, head]), parent);
    else {
      if (git(['rev-parse', '--is-shallow-repository'], 'completitud de historia').trim() === 'true') throw new Error('La historia shallow no permite verificar la base.');
      add([...tree(head).keys()], null);
    }
  }
  add(diff([head]), head); add(diff(['--cached', head]), head);
  add(records(git(['ls-files', '--others', '--exclude-standard', '-z'], 'archivos nuevos')), head);
  return {
    files: [...paths].map(([file, baselines]) => ({ file, baselines: [...baselines] })),
    baseline(file, revision) {
      if (revision === null) return undefined;
      const entry = tree(revision).get(file);
      if (!entry || !['100644', '100755'].includes(entry.mode)) return undefined;
      return git(['cat-file', 'blob', entry.blob], 'lectura del archivo base');
    },
  };
}

/** Las rutas se analizan literalmente y no pueden conducir a fuentes ajenas. */
export function readLintSource(root, file) {
  const absolute = resolve(root, file);
  if (!absolute.startsWith(resolve(root) + sep) || file.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw new Error('Ruta de fuente fuera del workspace.');
  let current = root;
  try {
    for (const part of file.split('/')) {
      current = resolve(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new Error('No se analizan enlaces de fuentes: ' + file);
    }
    if (!lstatSync(absolute).isFile()) throw new Error('La fuente no es un archivo regular: ' + file);
    return { absolute, source: readFileSync(absolute, 'utf8') };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}
