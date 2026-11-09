import assert from 'node:assert/strict';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build, createServer } from 'vite';
import { createPublicEnvDefines } from '../../config/vite/env-defines.mts';

test('Vite entrega la configuración SOFIA al renderer en desarrollo y en el build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soflia-vite-env-'));
  const entry = join(root, 'entry.js');
  const define = createPublicEnvDefines({
    VITE_SOFIA_SUPABASE_URL: 'https://sofia.example.test',
    VITE_SOFIA_SUPABASE_ANON_KEY: 'anon-ficticia',
    VITE_OPENAI_API_KEY: 'openai-privada-ficticia',
    VITE_GEMINI_API_KEY: 'gemini-privada-ficticia',
  });
  const config = { root, configFile: false, envPrefix: [], define, logLevel: 'silent' };
  try {
    await writeFile(entry, 'globalThis.fixture = [import.meta.env.VITE_SOFIA_SUPABASE_URL, import.meta.env.VITE_SOFIA_SUPABASE_ANON_KEY, import.meta.env.VITE_OPENAI_API_KEY, import.meta.env.VITE_GEMINI_API_KEY];');
    const server = await createServer({ ...config, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false } });
    try {
      const result = await server.transformRequest('/entry.js');
      assert.match(result.code, /sofia\.example\.test/);
      assert.match(result.code, /anon-ficticia/);
      assert.doesNotMatch(result.code, /privada-ficticia/);
    } finally {
      await server.close();
    }
    const result = await build({ ...config, build: { write: false, rolldownOptions: { input: entry } } });
    const code = result.output.find(item => item.type === 'chunk').code;
    assert.match(code, /sofia\.example\.test/);
    assert.match(code, /anon-ficticia/);
    assert.doesNotMatch(code, /privada-ficticia/);
  } finally {
    await unlink(entry);
    await rmdir(root);
  }
});
