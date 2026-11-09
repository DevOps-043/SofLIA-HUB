import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { projectRoot, buildEnvironment } from './smoke-app-build.mjs';

const configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-lint-git-config-'));
const emptyGitConfig = path.join(configDirectory, 'gitconfig'); fs.writeFileSync(emptyGitConfig, '');
const environment = () => ({ ...buildEnvironment(process.env), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyGitConfig });
function runCLI(root, baseRef = '') {
  const result = spawnSync(process.execPath, ['scripts/quality/lint-changed.mjs'], { cwd: root,
    env: { ...environment(), HARNESS_BASE_REF: baseRef }, encoding: 'utf8', timeout: 45000, windowsHide: true });
  assert.ifError(result.error); assert.equal(result.signal, null); return { code: result.status, output: result.stdout + result.stderr };
}

function fixture(source = 'export const base = 1;\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-lint-cli-'));
  fs.mkdirSync(path.join(root, 'scripts/quality'), { recursive: true }); fs.mkdirSync(path.join(root, 'empty-hooks'));
  for (const file of ['eslint.config.mjs', 'scripts/quality/lint-changed.mjs', 'scripts/quality/lint-baseline.mjs', 'scripts/quality/lint-git-scope.mjs']) {
    if (fs.existsSync(path.join(projectRoot, file))) fs.copyFileSync(path.join(projectRoot, file), path.join(root, file));
  }
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}');
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
  const write = (file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=' + path.join(root, 'empty-hooks'), '-c', 'commit.gpgsign=false',
    '-c', 'user.name=QA', '-c', 'user.email=qa@example.test', ...args], { cwd: root, env: environment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const commit = () => { git(['add', '.']); git(['commit', '-qm', 'Snapshot propio de QA']); return git(['rev-parse', 'HEAD']); };
  git(['init', '-q']); write('src/muestra.ts', source); const base = commit();
  return { root, write, git, commit, base, run: baseRef => runCLI(root, baseRef) };
}

test('CLI rechaza una incidencia comprometida en PR contra su base', () => {
  const repo = fixture(); repo.write('src/nueva.ts', 'const perdida: number = 1;\n'); repo.commit();
  const result = repo.run(repo.base); assert.equal(result.code, 1); assert.match(result.output, /no-unused-vars/);
});

for (const extension of ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']) {
  test('CLI incluye una fuente nueva .' + extension, () => {
    const repo = fixture(); const source = ['tsx', 'jsx'].includes(extension) ? 'const vista = <div />;\n'
      : ['ts', 'mts', 'cts'].includes(extension) ? 'const perdida: number = 1;\n' : 'const perdida = 1;\n';
    repo.write('src/nueva.' + extension, source);
    const result = repo.run(); assert.equal(result.code, 1); assert.match(result.output, /no-unused-vars/);
  });
}

test('CLI no omite referencias configuradas inválidas aunque no haya cambios locales', () => {
  const result = fixture().run('referencia-qa-inexistente'); assert.equal(result.code, 1); assert.match(result.output, /referencia|Git/i);
});

test('CLI falla cuando la referencia no comparte ancestro', () => {
  const repo = fixture(); repo.git(['checkout', '-q', '--orphan', 'codex/qa-ajena']);
  repo.write('src/ajena.ts', 'export const ajena = 1;\n'); assert.notEqual(repo.commit(), repo.base);
  const result = repo.run(repo.base); assert.equal(result.code, 1); assert.match(result.output, /ancestro|Git/i);
});

test('CLI acepta deuda histórica sin aumento y rechaza incrementar su cantidad', () => {
  const repo = fixture('const historica = 1;\n'); repo.write('src/muestra.ts', 'const historica = 2;\n');
  assert.equal(repo.run().code, 0);
  repo.write('src/muestra.ts', 'const historica = 2; const nueva = 3;\n'); assert.equal(repo.run().code, 1);
});

test('CLI revalida HEAD para una regresión local aunque la base del PR tuviera más deuda', () => {
  const repo = fixture('const historica = 1;\n'); repo.write('src/muestra.ts', 'export const historica = 1;\n'); repo.commit();
  repo.write('src/muestra.ts', 'const historica = 2;\n'); assert.equal(repo.run(repo.base).code, 1);
});

test('CLI compara contra merge-base cuando la base avanza en paralelo', () => {
  const repo = fixture(); repo.git(['checkout', '-qb', 'codex/qa-feature']);
  repo.write('src/nueva.ts', 'const perdida = 1;\n'); const feature = repo.commit();
  repo.git(['checkout', '-qb', 'codex/qa-base-avanzada', repo.base]); repo.write('src/nueva.ts', 'const perdida = 2;\n'); const advanced = repo.commit();
  repo.git(['checkout', '-q', feature]); const result = repo.run(advanced);
  assert.equal(result.code, 1); assert.match(result.output, /no-unused-vars/);
});

test('CLI trata espacios, Unicode y corchetes como ruta literal', () => {
  const repo = fixture(); repo.write('src/omisión [1].mjs', 'const perdida = 1;\n');
  const result = repo.run(); assert.equal(result.code, 1); assert.match(result.output, /omisión \[1\]/);
});

test('CLI detecta fuente staged y respeta archivos eliminados/exclusiones explícitas', () => {
  const repo = fixture(); repo.write('scripts/nuevo.cjs', 'const perdida = 1;\n'); repo.git(['add', 'scripts/nuevo.cjs']);
  assert.equal(repo.run().code, 1);
  // Sólo archivos creados en este fixture; no se elimina ni recorre el workspace.
  fs.unlinkSync(path.join(repo.root, 'scripts/nuevo.cjs')); fs.unlinkSync(path.join(repo.root, 'src/muestra.ts'));
  repo.write('.worktrees/qa/oculto.ts', 'const perdida = 1;\n'); repo.write('dist/salida.js', 'const perdida = 1;\n');
  assert.equal(repo.run().code, 0);
});

test('CLI rechaza parser fatal en la base aunque la fuente actual sea válida', () => {
  const repo = fixture('const invalido: =\n'); repo.write('src/muestra.ts', 'export const valido = 1;\n');
  const result = repo.run(); assert.equal(result.code, 1); assert.match(result.output, /parser|analizar/i);
});

test('CLI revisa fuentes del primer commit contra baseline vacío', () => {
  const repo = fixture('const perdida = 1;\n'); const result = repo.run();
  assert.equal(result.code, 1); assert.match(result.output, /no-unused-vars/);
});

test('CLI mantiene la configuración canónica ante una configuración anidada vacía', () => {
  const repo = fixture(); repo.write('src/eslint.config.mjs', 'export default [];\n');
  repo.write('src/nueva.js', 'const perdida = 1;\n');
  const result = repo.run(); assert.equal(result.code, 1); assert.match(result.output, /no-unused-vars/);
});

test('CLI no sigue junctions o symlinks de fuentes hacia otro directorio', () => {
  const repo = fixture(); const target = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-lint-target-'));
  fs.writeFileSync(path.join(target, 'fuente.mjs'), 'const MARCADOR_PRIVADO_DE_QA = 1;\n');
  fs.symlinkSync(target, path.join(repo.root, 'src/enlace.mjs'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = repo.run(); assert.equal(result.code, 1); assert.match(result.output, /enlace/);
  assert.ok(!result.output.includes('MARCADOR_PRIVADO_DE_QA'));
});

test('CLI rechaza historia shallow sin padre comparable', () => {
  const repo = fixture(); repo.write('src/nueva.ts', 'const perdida = 1;\n'); repo.commit();
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-lint-shallow-'));
  repo.git(['clone', '-q', '--depth', '1', pathToFileURL(repo.root).href, clone]);
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(clone, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = runCLI(clone); assert.equal(result.code, 1); assert.match(result.output, /shallow|historia/i);
});
