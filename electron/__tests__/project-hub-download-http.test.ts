import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectHubApiService } from '../project-hub/service';
import { readProjectDownload } from '../project-hub/download';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred, tokenPair, workspace, WORKSPACE_ID as ID } from './project-hub/fixtures';

vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => getAuthState().userId }));
const EVIDENCE = '22345678-1234-4123-8123-123456789012';
const bytes = Buffer.from('Contenido ficticio íntegro á');
const storagePath = `${ID}/${ID}/${EVIDENCE}.txt`;
const hash = createHash('sha256').update(bytes).digest('hex');
const seen: { path: string; bearer?: string; cookie?: string }[] = [];
let origin: string, root: string, mode = '';
let started = deferred<void>(), closed = deferred<void>();
const server = createServer((request, response) => {
  const route = request.url!.split('?')[0]; seen.push({ path: route, bearer: request.headers.authorization, cookie: request.headers.cookie });
  response.setHeader('connection', 'close');
  const json = (data: unknown) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ data })); };
  if (route.endsWith('/exchange')) { json({ ...tokenPair(), workspaces: [workspace()] }); return; }
  if (route.endsWith(`/evidence/${EVIDENCE}`)) {
    json({ evidence_id: EVIDENCE, workspace_id: ID, project_id: ID, evidence_type: 'upload', archived_at: null,
      storage_path: storagePath, mime_type: 'text/plain', file_size_bytes: bytes.length, content_hash: hash,
      title: 'archivo.txt', metadata: { upload_state: 'ready', original_name: 'archivo.txt' } }); return;
  }
  if (route.endsWith('/download')) { json({ signed_url: `${origin}/storage/v1/object/sign/project-files/${storagePath}?token=token-ficticio`, expires_in: 300 }); return; }
  if (route.startsWith('/storage/')) {
    if (mode === 'redirect') { response.writeHead(307, { location: origin + '/sink' }); response.end(); return; }
    if (mode === 'hold') { response.writeHead(200); response.write(bytes.subarray(0, 1)); response.once('close', () => closed.resolve()); started.resolve(); return; }
    if (mode === 'hash') { response.end(Buffer.alloc(bytes.length, 0x41)); return; }
    if (mode === 'extra') { response.end(Buffer.concat([bytes, bytes])); return; }
    response.end(bytes); return;
  }
  response.writeHead(404); response.end('{}');
});
beforeAll(async () => {
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-download-http-test-'));
});
beforeEach(() => {
  seen.length = 0; mode = ''; started = deferred<void>(); closed = deferred<void>();
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); vi.stubEnv('VITE_IRIS_SUPABASE_URL', origin);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); resetAuthStateForTests(); server.closeAllConnections(); });
afterAll(async () => {
  await new Promise<void>(resolve => { server.close(() => resolve()); });
  const resolved = await fs.realpath(root); expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^soflia-download-http-test-/); await fs.rm(resolved, { recursive: true, force: true });
});
async function fixture() {
  const service = new ProjectHubApiService(origin, { load: vi.fn(), save: vi.fn(), clear: vi.fn() });
  expect((await service.exchangeSofiaToken('sofia-ficticio')).success).toBe(true);
  const destination = path.join(root, `copia-${crypto.randomUUID()}.txt`); const controller = new AbortController();
  const auth = { userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => { if (controller.signal.aborted) throw new Error('cancelado'); },
    chooseDestination: vi.fn(async (): Promise<string | null> => destination) };
  const run = () => service.downloadFile({ workspaceId: ID, projectId: ID, evidenceId: EVIDENCE }, auth);
  return { service, controller, auth, destination, run };
}
describe('Descarga con HTTP y disco reales ficticios', () => {
  it('autoriza metadata/URL con sesión y separa Storage de bearer/cookies', async () => {
    const f = await fixture(); expect(await f.run()).toEqual({ success: true, data: { saved: true, bytes: bytes.length } });
    expect(await fs.readFile(f.destination)).toEqual(bytes); const storage = seen.filter(item => item.path.startsWith('/storage/'));
    expect(storage).toHaveLength(1); expect(storage[0].bearer).toBeUndefined(); expect(storage[0].cookie).toBeUndefined();
    expect(seen.find(item => item.path.endsWith('/download'))?.bearer).toMatch(/^Bearer /);
  });
  it.each(['redirect', 'hash', 'extra'])('rechaza %s real sin publicar ni reintentar', async selectedMode => {
    const f = await fixture(); mode = selectedMode; expect(await f.run()).toMatchObject({ success: false, data: { saved: false } });
    await expect(fs.lstat(f.destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(seen.some(item => item.path === '/sink')).toBe(false); expect(seen.filter(item => item.path.startsWith('/storage/'))).toHaveLength(1);
  });
  it('cancelar cuerpo en curso cierra conexión sin archivo parcial', async () => {
    const f = await fixture(); mode = 'hold'; const pending = f.run(); await started.promise; f.controller.abort();
    expect(await pending).toMatchObject({ cancelled: true, data: { saved: false } }); await closed.promise;
    await expect(fs.lstat(f.destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('A/B/A durante selector invalida lease antes de pedir URL', async () => {
    const f = await fixture(); f.auth.chooseDestination.mockImplementationOnce(async () => {
      setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); return f.destination;
    });
    expect(await f.run()).toMatchObject({ success: false, data: { saved: false } });
    expect(seen.some(item => item.path.endsWith('/download') || item.path.startsWith('/storage/'))).toBe(false);
  });
  it('timeout aborta una sola petición y libera timer sin exponer error', async () => {
    vi.useFakeTimers(); const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('token-ficticio')), { once: true });
    })); vi.stubGlobal('fetch', fetch);
    const rejected = expect(readProjectDownload('https://storage.example.test/ficticio', { name: 'archivo.txt', extension: 'txt', mime: 'text/plain', size: bytes.length,
      sha256: hash, storagePath }, { signal: new AbortController().signal, assert: () => {} })).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30_000); await rejected; expect(fetch).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
