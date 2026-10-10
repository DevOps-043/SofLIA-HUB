import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import type { AgentScope } from '../../src/shared/agent-runtime';
const execute = promisify(execFile);
export interface CodexConfiguration { executable: string; version: string; model?: string }
export function codexHome(root: string, scope: AgentScope): string {
  return path.join(root, createHash('sha256').update(JSON.stringify(scope)).digest('hex'));
}
export function isolatedEnvironment(home: string): NodeJS.ProcessEnv {
  // Los campos VITE ampliados por el proyecto no pertenecen al proceso auxiliar.
  const result = {} as NodeJS.ProcessEnv;
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'LANG']) {
    if (process.env[name]) result[name] = process.env[name];
  }
  return { ...result, CODEX_HOME: home, HOME: home, USERPROFILE: home };
}
export async function prepareCodexHome(home: string): Promise<void> {
  await fs.mkdir(path.join(home, 'workspace'), { recursive: true });
  // El hogar es exclusivo de SofLIA. La configuración no hereda plugins, hooks ni MCP personales.
  const configuration = [
    'approval_policy = "never"', 'sandbox_mode = "read-only"', 'web_search = "disabled"',
    'cli_auth_credentials_store = "ephemeral"',
    '[features]', 'shell_tool = false', 'multi_agent = false', 'multi_agent_v2 = false',
    'code_mode = false', 'apps = false', 'hooks = false',
    '[shell_environment_policy]', 'inherit = "none"', 'ignore_default_excludes = false',
  ].join('\n') + '\n';
  const file = path.join(home, 'config.toml');
  if (await fs.readFile(file, 'utf8').catch(() => '') === configuration) return;
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(temporary, configuration, { mode: 0o600 });
  await fs.rename(temporary, file);
}
export async function verifyCodexExecutable(executable: string, signal?: AbortSignal): Promise<CodexConfiguration> {
  if (!path.isAbsolute(executable) || (process.platform === 'win32' && path.extname(executable).toLowerCase() !== '.exe')) throw new Error('Selecciona el ejecutable nativo de Codex.');
  const stat = await fs.stat(executable);
  if (!stat.isFile()) throw new Error('La ruta seleccionada no es un ejecutable.');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-codex-check-'));
  try {
    const options = { windowsHide: true, timeout: 20_000, maxBuffer: 1_000_000, env: isolatedEnvironment(directory), cwd: directory, signal };
    const { stdout } = await execute(executable, ['--version'], options);
    if (!/^codex-cli [\w.+-]+\s*$/.test(stdout)) throw new Error('El ejecutable no se identifica como Codex.');
    await execute(executable, ['app-server', 'generate-json-schema', '--experimental', '--out', path.join(directory, 'schema')], options);
    const schema = JSON.parse(await fs.readFile(path.join(directory, 'schema', 'v2', 'ThreadStartParams.json'), 'utf8'));
    if (!schema.properties?.environments || !schema.properties?.dynamicTools || !schema.properties?.selectedCapabilityRoots
      || !schema.definitions?.SandboxMode?.enum?.includes('read-only')) throw new Error('Esta versión de Codex no permite el aislamiento requerido.');
    return { executable, version: stdout.trim() };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
