import { spawnSync } from 'node:child_process';

const root = process.cwd();
const npmCli = process.env.npm_execpath;
const release = process.argv.includes('--release');
const scripts = [
  'adapters:check',
  'harness:validate',
  'audit:supply-chain',
  'docs:system:check',
  'docs:check',
  'openspec:validate',
  'typecheck',
  'lint:changed',
  'test',
];
if (release) scripts.push('build');

for (const script of scripts) {
  console.log(`\n=== npm run ${script} ===`);
  const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = npmCli ? [npmCli, 'run', script] : ['run', script];
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: !npmCli && process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nCompuerta ${release ? 'de release' : 'de PR'} completada.`);
