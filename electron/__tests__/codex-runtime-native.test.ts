import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { verifyCodexExecutable, prepareCodexHome, isolatedEnvironment } from '../codex-runtime/configuration';
import { CodexTransport } from '../codex-runtime/transport';

describe('Codex instalado: contrato nativo sin inferencia', () => {
  it.skipIf(!process.env.SOFLIA_CODEX_TEST_EXECUTABLE)('verifica esquema, configuración aislada y handshake real', async () => {
    const executable = process.env.SOFLIA_CODEX_TEST_EXECUTABLE!;
    const config = await verifyCodexExecutable(executable);
    expect(config.version).toMatch(/^codex-cli /);
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-codex-smoke-'));
    let transport: CodexTransport | null = null;
    try {
      await prepareCodexHome(home);
      const child = spawn(executable, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false, cwd: path.join(home, 'workspace'), env: isolatedEnvironment(home) });
      const exited = new Promise(resolve => child.once('exit', resolve));
      transport = new CodexTransport(child);
      const result = await transport.request('initialize', { clientInfo: { name: 'soflia-hub-test', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      expect(result).toBeTypeOf('object');
      transport.send({ method: 'initialized', params: {} });
      const started = await transport.request('thread/start', {
        environments: [], selectedCapabilityRoots: [], ephemeral: true,
        sandbox: 'read-only', approvalPolicy: 'never',
        dynamicTools: [{ type: 'function', name: 'leer_transcripcion', description: 'Lee la fuente de prueba.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }],
      }) as { thread: { id: string; environments: unknown[] }; instructionSources: unknown[] };
      expect(started.thread.environments).toEqual([]);
      expect(started.instructionSources).toEqual([]);
      const inventory = await transport.request('mcpServerStatus/list', { threadId: started.thread.id, limit: 1 }) as { data: unknown[] };
      expect(inventory.data).toEqual([]);
      transport.close();
      await exited;
      transport = null;
      expect(await fs.readFile(path.join(home, 'config.toml'), 'utf8')).toContain('cli_auth_credentials_store = "ephemeral"');
    } finally {
      transport?.close();
      await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 60_000);
});
