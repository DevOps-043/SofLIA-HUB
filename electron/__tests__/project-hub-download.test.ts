import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadProjectFile } from '../project-hub/download';
import { projectDownloadDescription, projectDownloadUrl } from '../project-hub/download-target';
import { prepareProjectDownloadDestination } from '../project-hub/download-destination';
import { WORKSPACE_ID as ID } from './project-hub/fixtures';
import type { ProjectHubApiService } from '../project-hub/service';

const EVIDENCE = '22345678-1234-4123-8123-123456789012';
const bytes = Buffer.from('Contenido íntegro ficticio á');
const origin = 'https://storage.example.test';
const target = { workspaceId: ID, projectId: ID, evidenceId: EVIDENCE };
const metadata = () => ({ evidence_id: EVIDENCE, workspace_id: ID, project_id: ID, evidence_type: 'upload', archived_at: null,
  storage_path: `${ID}/${ID}/${EVIDENCE}.txt`, mime_type: 'text/plain', file_size_bytes: bytes.length,
  content_hash: createHash('sha256').update(bytes).digest('hex'), title: 'archivo.txt', metadata: { upload_state: 'ready', original_name: 'archivo.txt' } });
const signed = () => ({ signed_url: `${origin}/storage/v1/object/sign/project-files/${metadata().storage_path}?token=token-ficticio`, expires_in: 300 });
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-download-test-')); });
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); const resolved = await fs.realpath(root);
  expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir())); expect(path.basename(resolved)).toMatch(/^soflia-download-test-/);
  await fs.rm(resolved, { recursive: true, force: true });
});
function fixture() {
  const controller = new AbortController(); const assert = () => { if (controller.signal.aborted) throw new Error('contexto-ficticio'); };
  const lease = { userId: 'usuario', signal: controller.signal, assert, dispose: () => {} };
  const backend = { getEvidence: vi.fn(async () => ({ success: true, data: metadata() })), getDownload: vi.fn(async () => ({ success: true, data: signed() })) };
  const destination = path.join(root, 'copia.txt'); const chooseDestination = vi.fn(async (): Promise<string | null> => destination);
  const run = () => downloadProjectFile(target, backend as unknown as Pick<ProjectHubApiService, 'getEvidence' | 'getDownload'>,
    { userId: lease.userId, signal: controller.signal, assertCurrent: assert, chooseDestination }, lease, origin);
  return { controller, lease, backend, destination, chooseDestination, run };
}
describe('Metadata/URL de descarga comprobadas', () => {
  it('deriva metadata de evidencia ready sin interpretar nombre como ruta', () => {
    const data = metadata(); data.metadata.original_name = '../../secreto.txt';
    const file = projectDownloadDescription(data, target); expect(file.name).toBe(`archivo-${EVIDENCE}.txt`);
    expect(projectDownloadUrl(signed(), origin, file)).toBe(signed().signed_url);
  });
  it.each(['id', 'workspace', 'proyecto', 'archivado', 'pending', 'tipo', 'MIME', 'tamaño', 'hash', 'path'])('rechaza evidencia %s incoherente', mode => {
    const data: Record<string, unknown> = metadata();
    if (mode === 'id') data.evidence_id = ID;
    if (mode === 'workspace') data.workspace_id = EVIDENCE;
    if (mode === 'proyecto') data.project_id = EVIDENCE;
    if (mode === 'archivado') data.archived_at = '2026-10-22';
    if (mode === 'pending') data.metadata = { upload_state: 'pending' };
    if (mode === 'tipo') data.evidence_type = 'link';
    if (mode === 'MIME') data.mime_type = 'application/x-ejecutable';
    if (mode === 'tamaño') data.file_size_bytes = 21 * 1024 * 1024;
    if (mode === 'hash') data.content_hash = 'no-hash';
    if (mode === 'path') data.storage_path = `otro/${EVIDENCE}.txt`;
    expect(() => projectDownloadDescription(data, target)).toThrow();
  });
  it.each(['host', 'path', 'bucket', 'token', 'query', 'fragment', 'userinfo', 'TTL'])('rechaza URL %s inválida antes de bytes', mode => {
    const data = signed();
    if (mode === 'host') data.signed_url = data.signed_url.replace('storage.example.test', 'externo.example.test');
    if (mode === 'path') data.signed_url = data.signed_url.replace(EVIDENCE, ID);
    if (mode === 'bucket') data.signed_url = data.signed_url.replace('project-files', 'otro');
    if (mode === 'token') data.signed_url = data.signed_url.replace('token-ficticio', '');
    if (mode === 'query') data.signed_url += '&download=otro';
    if (mode === 'fragment') data.signed_url += '#fragmento';
    if (mode === 'userinfo') data.signed_url = data.signed_url.replace('https://', 'https://usuario:clave@');
    if (mode === 'TTL') data.expires_in = 301;
    expect(() => projectDownloadUrl(data, origin, projectDownloadDescription(metadata(), target))).toThrow();
  });
});
describe('Copia nueva completa y cancelable', () => {
  it('publica bytes íntegros y no devuelve ruta/URL/token', async () => {
    const f = fixture(); const fetch = vi.fn(async () => new Response(bytes)); vi.stubGlobal('fetch', fetch);
    const result = await f.run(); expect(result).toEqual({ success: true, data: { saved: true, bytes: bytes.length } });
    expect(await fs.readFile(f.destination)).toEqual(bytes); expect(await fs.readdir(root)).toEqual(['copia.txt']);
    expect(JSON.stringify(result)).not.toMatch(/token-ficticio|storage.example|copia.txt/);
    const options = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]; expect(options).toMatchObject({ redirect: 'error', credentials: 'omit', cache: 'no-store' });
    expect(new Headers(options.headers).has('authorization')).toBe(false);
  });
  it('cancelar selector no pide URL ni bytes', async () => {
    const f = fixture(); f.chooseDestination.mockResolvedValueOnce(null);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); expect(await f.run()).toMatchObject({ cancelled: true, data: { saved: false } });
    expect(fetch).not.toHaveBeenCalled(); expect(f.backend.getDownload).not.toHaveBeenCalled(); expect(await fs.readdir(root)).toEqual([]);
  });
  it.each(['hash', 'tamaño', 'firma', 'UTF-8', 'declarado'])('no publica bytes con %s inválido', async mode => {
    const f = fixture(); let body = Buffer.from(bytes); const headers: Record<string, string> = {};
    if (mode === 'hash') body[0] = 0x41;
    if (mode === 'tamaño') body = body.subarray(1);
    if (mode === 'firma') {
      const data = metadata(); data.mime_type = 'application/pdf'; data.storage_path = data.storage_path.replace('.txt', '.pdf');
      f.backend.getEvidence.mockResolvedValueOnce({ success: true, data });
      f.chooseDestination.mockResolvedValueOnce(path.join(root, 'copia.pdf'));
      f.backend.getDownload.mockResolvedValueOnce({ success: true, data: { ...signed(), signed_url: signed().signed_url.replace('.txt', '.pdf') } });
    }
    if (mode === 'UTF-8') body[0] = 0xff;
    if (mode === 'declarado') headers['content-length'] = String(21 * 1024 * 1024);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers })));
    const result = await f.run(); expect(result.success).toBe(false); expect(await fs.readdir(root)).toEqual([]);
    expect(f.backend.getDownload).toHaveBeenCalledOnce();
  });
  it('no sobrescribe un destino existente ni pide bytes para él', async () => {
    const f = fixture(); await fs.writeFile(f.destination, 'conservar'); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await f.run()).toMatchObject({ code: 'DESTINATION_EXISTS', data: { saved: false } });
    expect(await fs.readFile(f.destination, 'utf8')).toBe('conservar'); expect(fetch).not.toHaveBeenCalled();
  });
  it('la colisión durante red tampoco reemplaza el archivo', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => { await fs.writeFile(f.destination, 'creado-después'); return new Response(bytes); }));
    expect(await f.run()).toMatchObject({ code: 'DESTINATION_EXISTS' }); expect(await fs.readFile(f.destination, 'utf8')).toBe('creado-después');
    expect(await fs.readdir(root)).toEqual(['copia.txt']);
  });
  it('colisión atómica en link conserva el archivo rival y limpia sólo staging', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const link = fs.link; vi.spyOn(fs, 'link').mockImplementationOnce(async (...args) => { await fs.writeFile(f.destination, 'conservar'); await link(...args); });
    expect(await f.run()).toMatchObject({ code: 'DESTINATION_EXISTS', data: { saved: false } });
    expect(await fs.readFile(f.destination, 'utf8')).toBe('conservar'); expect(await fs.readdir(root)).toEqual(['copia.txt']);
  });
  it('valida una firma binaria dividida en chunks de un byte', async () => {
    const f = fixture(); const body = Buffer.from([0xff, 0xd8, 0xff, 0x01]); const data = metadata();
    Object.assign(data, { mime_type: 'image/jpeg', storage_path: data.storage_path.replace('.txt', '.jpg'), file_size_bytes: body.length, content_hash: createHash('sha256').update(body).digest('hex') });
    f.backend.getEvidence.mockResolvedValueOnce({ success: true, data }); f.chooseDestination.mockResolvedValueOnce(path.join(root, 'copia.jpg'));
    f.backend.getDownload.mockResolvedValueOnce({ success: true, data: { ...signed(), signed_url: signed().signed_url.replace('.txt', '.jpg') } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(controller) { for (const byte of body) controller.enqueue(new Uint8Array([byte])); controller.close(); } }))));
    expect(await f.run()).toMatchObject({ success: true, data: { saved: true, bytes: 4 } }); expect(await fs.readFile(path.join(root, 'copia.jpg'))).toEqual(body);
  });
  it('cancelación tras recibir bytes no publica ni deja temporal', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => { f.controller.abort(); return new Response(bytes); }));
    expect(await f.run()).toMatchObject({ cancelled: true, data: { saved: false } }); expect(await fs.readdir(root)).toEqual([]);
  });
  it('fallo de publicación no deja final parcial y limpia staging', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    vi.spyOn(fs, 'link').mockRejectedValueOnce(new Error('fallo-ficticio-del-disco'));
    const result = await f.run(); expect(result.success).toBe(false); expect(await fs.readdir(root)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('fallo-ficticio');
  });
  it('cancelar tras el hard link conserva saved verdadero y la copia aprobada', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const link = fs.link; vi.spyOn(fs, 'link').mockImplementationOnce(async (...args) => { await link(...args); f.controller.abort(); });
    const result = await f.run(); expect(result).toMatchObject({ success: false, cancelled: true, recoveryRequired: true, data: { saved: true, bytes: bytes.length } });
    expect(await fs.readFile(f.destination)).toEqual(bytes); expect(await fs.readdir(root)).toEqual(['copia.txt']);
  });
  it('un fallo de confirmación del link no afirma rollback aunque se haya publicado', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const link = fs.link; vi.spyOn(fs, 'link').mockImplementationOnce(async (...args) => {
      await link(...args); f.controller.abort(); throw new Error('resultado-nativo-no-confirmado');
    });
    const result = await f.run(); expect(result).toMatchObject({ success: false, cancelled: true, uncertain: true, recoveryRequired: true, data: { saved: false } });
    expect(await fs.readFile(f.destination)).toEqual(bytes); expect(await fs.readdir(root)).toEqual(['copia.txt']);
    expect(JSON.stringify(result)).not.toContain('resultado-nativo');
  });
  it('rechaza extensión local distinta del MIME y directorio sustituido', async () => {
    await expect(prepareProjectDownloadDestination(path.join(root, 'ejecutable.exe'), 'text/plain', () => {})).rejects.toThrow();
    const selected = path.join(root, 'directorio'); await fs.mkdir(selected);
    const target = await prepareProjectDownloadDestination(path.join(selected, 'archivo.txt'), 'text/plain', () => {});
    await fs.rename(selected, path.join(root, 'anterior')); await fs.mkdir(selected);
    await expect(target.publish(bytes, () => {})).rejects.toThrow(); expect(await fs.readdir(selected)).toEqual([]);
  });
});
