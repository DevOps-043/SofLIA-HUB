import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const npmCli = process.env.npm_execpath;
const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const args = process.argv.slice(2);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runNpm(commandArgs) {
  if (npmCli) return run(process.execPath, [npmCli, ...commandArgs]);
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', commandArgs);
}

console.log('Preparando better-sqlite3 para la ABI de Node/Vitest...');
const prepareStatus = runNpm(['rebuild', 'better-sqlite3']);
if (prepareStatus !== 0) process.exit(prepareStatus);

let testStatus = 1;
try {
  testStatus = run(process.execPath, [vitest, 'run', ...args]);
} finally {
  console.log('Restaurando better-sqlite3 para la ABI de Electron...');
  const restoreStatus = runNpm(['run', 'rebuild:native:electron']);
  if (restoreStatus !== 0 && testStatus === 0) testStatus = restoreStatus;
}

process.exit(testStatus);
