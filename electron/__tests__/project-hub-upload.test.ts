import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadProjectFiles } from '../project-hub/upload';
import { projectStorageOrigin, projectUploadTarget } from '../project-hub/upload-target';
import type { ProjectHubApiService } from '../project-hub/service';
import { WORKSPACE_ID as ID } from './project-hub/fixtures';

const EVIDENCE = '22345678-1234-4123-8123-123456789012';
const origin = 'https://storage.example.test';
const intent = (evidence = EVIDENCE) => {
  const file = `${ID}/${ID}/${evidence}.txt`;
  return { evidence_id: evidence, path: file, token: 'token-ficticio', signed_url: `${origin}/storage/v1/object/upload/sign/project-files/${file}?token=token-ficticio` };
};
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-upload-flow-test-')); });
afterEach(async () => {
  vi.unstubAllGlobals(); const resolved = await fs.realpath(root);
  expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir())); expect(path.basename(resolved)).toMatch(/^soflia-upload-flow-test-/);
  await fs.rm(resolved, { recursive: true, force: true });
});
function fixture(count = 1) {
  const controller = new AbortController();
  const assert = () => { if (controller.signal.aborted) throw new Error('contexto-ficticio'); };
  const lease = { userId: 'usuario', signal: controller.signal, assert, dispose: () => {} };
  const approve = vi.fn(async () => true);
  const backend = {
    createUploadIntent: vi.fn(async () => ({ success: true, data: [intent()] })),
    completeUpload: vi.fn(async () => ({ success: true, data: { evidence_id: EVIDENCE, workspace_id: ID, project_id: ID, metadata: { upload_state: 'ready' } } })),
  };
  const input = { workspaceId: ID, projectId: ID, paths: Array.from({ length: count }, (_, index) => path.join(root, `prueba-${index}.txt`)) };
  const run = async () => {
    for (const file of input.paths) await fs.writeFile(file, 'Contenido ficticio');
    return uploadProjectFiles(input, backend as unknown as Pick<ProjectHubApiService, 'createUploadIntent' | 'completeUpload'>,
      { userId: lease.userId, signal: controller.signal, assertCurrent: assert, approve }, lease, origin);
  };
  return { controller, lease, approve, backend, input, run };
}
describe('Destino firmado vinculado a archivo/proyecto', () => {
  it.each(['', 'file:///tmp', 'http://remoto.example.test', 'https://user:pass@storage.example.test', 'https://storage.example.test/path', 'https://storage.example.test/?x=1'])('rechaza origen configurado inválido: %s', value => {
    expect(projectStorageOrigin(value)).toBe('');
  });
  it('acepta sólo origen HTTPS o loopback explícito y respuesta individual exacta', () => {
    expect(projectStorageOrigin(origin)).toBe(origin); expect(projectStorageOrigin('http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234');
    expect(projectUploadTarget([intent()], origin, ID, ID, 'txt').evidenceId).toBe(EVIDENCE);
  });
  it.each(['host', 'path', 'token', 'query', 'userinfo', 'fragment', 'bucket', 'doble', 'vacío', 'id', 'extensión'])('rechaza intención incoherente: %s', mode => {
    const value = intent();
    if (mode === 'host') value.signed_url = value.signed_url.replace('storage.example.test', 'externo.example.test');
    if (mode === 'path') value.path = value.path.replace(ID, EVIDENCE);
    if (mode === 'token') value.token = 'otro-token-ficticio';
    if (mode === 'query') value.signed_url += '&otra=clave';
    if (mode === 'userinfo') value.signed_url = value.signed_url.replace('https://', 'https://usuario:clave@');
    if (mode === 'fragment') value.signed_url += '#fragmento';
    if (mode === 'bucket') value.signed_url = value.signed_url.replace('project-files', 'otro-bucket');
    if (mode === 'id') value.evidence_id = 'no-uuid';
    const payload = mode === 'doble' ? [value, value] : mode === 'vacío' ? [] : [value];
    expect(() => projectUploadTarget(payload, origin, ID, ID, mode === 'extensión' ? 'pdf' : 'txt')).toThrow();
  });
});
describe('Subida secuencial y progreso confirmado', () => {
  it('usa sólo token de query y completa después de PUT sin publicar el secreto', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 })); vi.stubGlobal('fetch', fetch);
    const f = fixture(); const result = await f.run();
    expect(result).toMatchObject({ success: true, data: { requested: 1, prepared: 1, stored: 1, uploaded: 1 } });
    expect(fetch).toHaveBeenCalledOnce(); const options = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(options[1]).toMatchObject({ redirect: 'error', credentials: 'omit', method: 'PUT' });
    expect(new Headers(options[1].headers).has('authorization')).toBe(false); expect(f.backend.completeUpload).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toMatch(/token-ficticio|storage.example|prueba-0/);
  });
  it('cancelar aprobación no crea ningún efecto remoto', async () => {
    const f = fixture(); f.approve.mockResolvedValueOnce(false); const result = await f.run();
    expect(result).toMatchObject({ cancelled: true, data: { prepared: 0 } }); expect(f.backend.createUploadIntent).not.toHaveBeenCalled();
  });
  it('bytes cambiados al aprobar no llegan a la intención', async () => {
    const f = fixture(); f.approve.mockImplementationOnce(async () => { await fs.writeFile(f.input.paths[0], 'cambio'); return true; });
    expect((await f.run()).success).toBe(false); expect(f.backend.createUploadIntent).not.toHaveBeenCalled();
  });
  it('URL inválida no envía bytes ni complete y conserva resultado incierto', async () => {
    const f = fixture(); f.backend.createUploadIntent.mockResolvedValueOnce({ success: true, data: [{ ...intent(), signed_url: 'https://externo.example.test/robar' }] });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const result = await f.run();
    expect(result).toMatchObject({ success: false, uncertain: true, recoveryRequired: true, data: { uploaded: 0 } });
    expect(fetch).not.toHaveBeenCalled(); expect(f.backend.completeUpload).not.toHaveBeenCalled();
  });
  it('PUT rechazado no se repite ni llama complete', async () => {
    const f = fixture(); const fetch = vi.fn(async () => new Response('error-remoto-ficticio', { status: 403 })); vi.stubGlobal('fetch', fetch);
    const result = await f.run(); expect(result).toMatchObject({ success: false, data: { prepared: 1, stored: 0, uploaded: 0 }, recoveryRequired: true });
    expect(fetch).toHaveBeenCalledOnce(); expect(f.backend.completeUpload).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain('error-remoto');
  });
  it('un fallo posterior conserva el archivo ya confirmado y detiene el lote', async () => {
    const f = fixture(3); let count = 0;
    f.backend.createUploadIntent.mockImplementation(async () => ({ success: true, data: [intent(count++ ? '32345678-1234-4123-8123-123456789012' : EVIDENCE)] }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response()).mockRejectedValueOnce(new Error('secreto-ficticio')));
    const result = await f.run(); expect(result).toMatchObject({ success: false, partial: true, uncertain: true, data: { requested: 3, prepared: 2, stored: 1, uploaded: 1 } });
    expect(f.backend.completeUpload).toHaveBeenCalledOnce(); expect(f.backend.createUploadIntent).toHaveBeenCalledTimes(2);
  });
  it('cancelación durante PUT libera y no confirma ni pasa al siguiente archivo', async () => {
    const f = fixture(2); vi.stubGlobal('fetch', vi.fn(async () => { f.controller.abort(); throw new Error('aborto-ficticio'); }));
    const result = await f.run(); expect(result).toMatchObject({ cancelled: true, uncertain: true, data: { uploaded: 0 } });
    expect(f.backend.completeUpload).not.toHaveBeenCalled(); expect(f.backend.createUploadIntent).toHaveBeenCalledOnce();
  });
  it('un 200 sin evidencia ready del mismo destino no se cuenta como confirmado', async () => {
    const f = fixture(); f.backend.completeUpload.mockResolvedValueOnce({ success: true, data: { evidence_id: EVIDENCE, workspace_id: ID, project_id: ID, metadata: { upload_state: 'pending' } } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response()));
    expect(await f.run()).toMatchObject({ success: false, uncertain: true, data: { prepared: 1, stored: 1, uploaded: 0 } });
  });
});
