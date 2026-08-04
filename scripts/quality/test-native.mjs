import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = process.cwd();
const npmCli = process.env.npm_execpath;
const requireFromWorkspace = createRequire(join(root, 'package.json'));
const dependencyRoot = dirname(dirname(requireFromWorkspace.resolve('vitest/package.json')));
const vitest = join(dirname(requireFromWorkspace.resolve('vitest/package.json')), 'vitest.mjs');
const args = process.argv.slice(2);

function run(command, commandArgs, cwd = root) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runNpm(commandArgs, cwd = root) {
  if (npmCli) return run(process.execPath, [npmCli, ...commandArgs], cwd);
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', commandArgs, cwd);
}

console.log('Preparando better-sqlite3 para la ABI de Node/Vitest...');
const prepareStatus = runNpm(['rebuild', 'better-sqlite3'], dependencyRoot);
if (prepareStatus !== 0) process.exit(prepareStatus);

let testStatus = 1;
try {
  testStatus = run(process.execPath, [vitest, 'run', ...args]);
} finally {
  console.log('Restaurando better-sqlite3 para la ABI de Electron...');
  const restoreStatus = runNpm(['run', 'rebuild:native:electron'], dependencyRoot);
  if (restoreStatus !== 0 && testStatus === 0) testStatus = restoreStatus;
}

process.exit(testStatus);
