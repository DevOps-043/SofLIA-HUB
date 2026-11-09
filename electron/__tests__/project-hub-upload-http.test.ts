import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectHubApiService } from '../project-hub/service';
import { putProjectUpload } from '../project-hub/upload-target';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred, tokenPair, workspace, WORKSPACE_ID as ID } from './project-hub/fixtures';

vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => getAuthState().userId }));
const EVIDENCE = '22345678-1234-4123-8123-123456789012';
const seen: { path: string; method?: string; bearer?: string; body: Buffer }[] = [];
let origin: string, root: string, mode = '';
let started = deferred<void>(), closed = deferred<void>();
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const route = request.url!.split('?')[0]; seen.push({ path: route, method: request.method, bearer: request.headers.authorization, body: Buffer.concat(chunks) });
  response.setHeader('connection', 'close'); response.setHeader('content-type', 'application/json');
  if (route.endsWith('/exchange')) { response.end(JSON.stringify({ data: { ...tokenPair(), workspaces: [workspace()] } })); return; }
  if (route.endsWith('/intents')) {
    const file = `${ID}/${ID}/${EVIDENCE}.txt`;
    response.end(JSON.stringify({ data: [{ evidence_id: EVIDENCE, path: file, token: 'token-ficticio',
      signed_url: `${origin}/storage/v1/object/upload/sign/project-files/${file}?token=token-ficticio` }] })); return;
  }
  if (route.startsWith('/storage/')) {
    if (mode === 'redirect') { response.writeHead(307, { location: origin + '/sink' }); response.end(); return; }
    if (mode === 'hold') { response.once('close', () => closed.resolve()); started.resolve(); return; }
    response.end(JSON.stringify({ Key: 'project-files/ruta-ficticia' })); return;
  }
  if (route.endsWith('/complete')) {
    response.end(JSON.stringify({ data: { evidence_id: EVIDENCE, workspace_id: ID, project_id: ID, metadata: { upload_state: 'ready' } } })); return;
  }
  response.writeHead(404); response.end('{}');
});
beforeAll(async () => {
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-upload-http-test-'));
});
beforeEach(() => {
  seen.length = 0; mode = ''; started = deferred<void>(); closed = deferred<void>();
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); vi.stubEnv('VITE_IRIS_SUPABASE_URL', origin);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); resetAuthStateForTests(); });
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => resolve()); });
  const resolved = await fs.realpath(root); expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^soflia-upload-http-test-/); await fs.rm(resolved, { recursive: true, force: true });
});
async function fixture() {
  const selected = path.join(root, 'archivo.txt'); await fs.writeFile(selected, 'Contenido ficticio á');
  const service = new ProjectHubApiService(origin, { load: vi.fn(), save: vi.fn(), clear: vi.fn() });
  expect((await service.exchangeSofiaToken('sofia-ficticio')).success).toBe(true);
  const controller = new AbortController();
  const auth = { userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => {
    if (controller.signal.aborted) throw new Error('cancelado');
  }, approve: vi.fn(async () => true) };
  return { service, controller, auth, input: { workspaceId: ID, projectId: ID, paths: [selected] } };
}
describe('Subida main con HTTP y archivos reales ficticios', () => {
  it('ejecuta intención/PUT/complete y deja el token de sesión fuera de Storage', async () => {
    const f = await fixture(); const result = await f.service.uploadFiles(f.input, f.auth);
    expect(result).toMatchObject({ success: true, data: { uploaded: 1 } });
    const put = seen.find(item => item.method === 'PUT')!; expect(put.body.toString()).toBe('Contenido ficticio á'); expect(put.bearer).toBeUndefined();
    expect(seen.map(item => item.path.endsWith('/complete'))).toContain(true);
    expect(JSON.stringify(result)).not.toMatch(/token-ficticio|archivo.txt|storage/);
  });
  it('un 307 real no reenvía el cuerpo ni confirma el archivo', async () => {
    const f = await fixture(); mode = 'redirect'; const result = await f.service.uploadFiles(f.input, f.auth);
    expect(result).toMatchObject({ success: false, uncertain: true, data: { uploaded: 0 } });
    expect(seen.some(item => item.path === '/sink' || item.path.endsWith('/complete'))).toBe(false);
    expect(seen.filter(item => item.method === 'PUT')).toHaveLength(1);
  });
  it('cancelar el PUT cierra la conexión y no llama complete', async () => {
    const f = await fixture(); mode = 'hold'; const pending = f.service.uploadFiles(f.input, f.auth);
    await started.promise; f.controller.abort(); const result = await pending; await closed.promise;
    expect(result).toMatchObject({ cancelled: true, uncertain: true }); expect(seen.some(item => item.path.endsWith('/complete'))).toBe(false);
  });
  it('un cambio A/B/A durante aprobación evita crear la intención', async () => {
    const f = await fixture(); f.auth.approve.mockImplementationOnce(async () => {
      setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); return true;
    });
    expect((await f.service.uploadFiles(f.input, f.auth)).success).toBe(false); expect(seen.some(item => item.path.endsWith('/intents'))).toBe(false);
  });
  it('el plazo de PUT aborta sin retry y libera su timer', async () => {
    vi.useFakeTimers(); const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('secreto-ficticio')), { once: true });
    })); vi.stubGlobal('fetch', fetch);
    const rejected = expect(putProjectUpload('https://storage.example.test/ficticio', Buffer.from('texto'), 'text/plain', { signal: new AbortController().signal, assert: () => {} })).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30_000); await rejected; expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
