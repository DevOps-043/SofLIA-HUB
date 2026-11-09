import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { ProjectHubTransport } from '../project-hub/transport';
import { ProjectHubApiService } from '../project-hub/service';
import { ProjectHubSessionStore } from '../project-hub/session-store';
import { MAX_PROJECT_HUB_RESPONSE_BYTES, ProjectHubError, projectHubFailure } from '../project-hub/session-contract';
import { deferred, testCipher, tokenPair, workspace, WORKSPACE_ID } from './project-hub/fixtures';

vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => getAuthState().userId }));
const seen: { route: string; method?: string; authorization?: string; body: string }[] = [];
let base: string; let root: string;
let holdStarted = deferred<void>(); let holdClosed = deferred<void>();
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const route = request.url!;
  seen.push({ route, method: request.method, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString('utf8') });
  response.setHeader('content-type', 'application/json');
  // Cada caso cierra sus sockets; no reutilizar una conexión retirada por el anterior.
  response.setHeader('connection', 'close');
  if (route === '/redirect') { response.writeHead(307, { location: base + '/sink' }); response.end(); return; }
  if (route === '/hold') { response.once('close', () => holdClosed.resolve()); holdStarted.resolve(); return; }
  if (route === '/declared') { response.writeHead(200, { 'content-length': MAX_PROJECT_HUB_RESPONSE_BYTES + 1 }); response.flushHeaders(); return; }
  if (route === '/stream') { response.setHeader('transfer-encoding', 'chunked'); response.end(JSON.stringify({ data: 'x'.repeat(MAX_PROJECT_HUB_RESPONSE_BYTES) })); return; }
  if (route === '/error') { response.writeHead(403); response.end(JSON.stringify({ error: { code: 'SECRETO_FICTICIO', message: 'credencial-ficticia-no-publicar' } })); return; }
  if (route === '/api/v1/auth/sofia/exchange') { response.end(JSON.stringify({ data: { ...tokenPair(), workspaces: [workspace()] } })); return; }
  if (route === '/api/v1/auth/logout') { response.end(JSON.stringify({ data: { logged_out: true } })); return; }
  if (route.endsWith('/projects')) { response.end(JSON.stringify({ data: [{ project_id: WORKSPACE_ID, project_name: 'Proyecto ficticio' }] })); return; }
  response.end(JSON.stringify({ data: { ok: true }, meta: { correlation_id: WORKSPACE_ID, next_cursor: null, has_more: false } }));
});
beforeAll(async () => {
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-project-http-test-'));
});
beforeEach(() => { seen.length = 0; holdStarted = deferred<void>(); holdClosed = deferred<void>(); resetAuthStateForTests(); });
afterEach(() => { resetAuthStateForTests(); });
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => resolve()); });
  const resolved = await fs.realpath(root);
  expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^soflia-project-http-test-/);
  await fs.rm(resolved, { recursive: true, force: true });
});
function context(controller = new AbortController()) {
  return { accessToken: 'acceso-ficticio', signal: controller.signal, assert: () => {
    if (controller.signal.aborted) throw new ProjectHubError('SESSION_CHANGED', 'La sesión cambió.');
  } };
}

describe('Project Hub con HTTP real de loopback y datos ficticios', () => {
  it('envía su snapshot de token/JSON/clave y proyecta metadata válida', async () => {
    const transport = new ProjectHubTransport(base);
    const result = await transport.request('/ok', { method: 'POST', body: { nombre: 'Prueba' }, idempotencyKey: 'prueba-idempotente' }, context());
    expect(result).toEqual({ data: { ok: true }, meta: { correlation_id: WORKSPACE_ID, next_cursor: null, has_more: false } });
    expect(seen[0]).toMatchObject({ authorization: 'Bearer acceso-ficticio', method: 'POST', body: '{"nombre":"Prueba"}' });
  });
  it('no sigue un 307 que reenviaría un token del cuerpo a otro destino', async () => {
    const transport = new ProjectHubTransport(base);
    await expect(transport.request('/redirect', { method: 'POST', body: { refresh_token: 'ficticio-no-reenviar' } }, context())).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(seen.map(request => request.route)).toEqual(['/redirect']);
  });
  it.each(['/declared', '/stream'])('limita bytes por encabezado y por lectura real: %s', async route => {
    const transport = new ProjectHubTransport(base);
    await expect(transport.request(route, {}, context())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(seen).toHaveLength(1);
  });
  it('aborta un fetch pendiente y cierra la conexión al invalidar contexto', async () => {
    const controller = new AbortController(); const transport = new ProjectHubTransport(base);
    const rejected = expect(transport.request('/hold', {}, context(controller))).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await holdStarted.promise; controller.abort(); await rejected; await holdClosed.promise;
    expect(seen).toHaveLength(1);
  });
  it('no publica el mensaje/code sensible de un rechazo del servidor', async () => {
    const transport = new ProjectHubTransport(base);
    const result = await transport.request('/error', {}, context()).catch(projectHubFailure);
    expect(JSON.stringify(result)).not.toMatch(/SECRETO_FICTICIO|credencial-ficticia/);
    expect(result).toMatchObject({ success: false, code: 'HTTP_403' });
  });
  it('integra canje, custodia, lectura y logout de la fachada sin SDK remoto', async () => {
    setAuthState({ authenticated: true, userId: 'A' });
    const store = new ProjectHubSessionStore({ root: () => root, cipher: testCipher() });
    const service = new ProjectHubApiService(base, store);
    const exchange = await service.exchangeSofiaToken('sofia-ficticio');
    expect(exchange.success, JSON.stringify(exchange)).toBe(true);
    expect((await service.listProjects({ workspaceId: WORKSPACE_ID })).data).toEqual([{ project_id: WORKSPACE_ID, project_name: 'Proyecto ficticio' }]);
    expect(await store.load('A', () => {})).toMatchObject({ refreshToken: tokenPair().refresh_token });
    setAuthState({ authenticated: false, userId: null }); await service.logout();
    expect((await service.getStatus()).authenticated).toBe(false);
    expect(await store.load('A', () => {})).toBeNull();
    expect(seen.map(request => request.route)).toContain('/api/v1/auth/logout');
  });
});
