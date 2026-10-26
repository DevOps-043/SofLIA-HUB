import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCloudStorage } from '../project-hub/cloud-storage';
import type { ProjectCloudPort } from '../project-hub/cloud-types';
import { oneDriveProjectStorage } from '../project-hub/onedrive-project-storage';
import type { MicrosoftFilesAuth } from '../project-hub/microsoft-files-auth';

const root = { id: 'root-id', name: 'Raíz', folder: true, driveId: 'drive-id' };
let port: ProjectCloudPort;
let cloud: ProjectCloudStorage;
const auth = { userId: 'actor-a', assertCurrent: vi.fn(), signal: new AbortController().signal };
beforeEach(() => {
  port = { provider: 'google_drive', email: 'cuenta@example.test', assertCurrent: vi.fn(), assertAccount: vi.fn(), folder: vi.fn().mockResolvedValue(root), children: vi.fn().mockResolvedValue({ items: [{ ...root, id: 'child-id', name: 'Trabajo' }] }), createFolder: vi.fn().mockResolvedValue({ ...root, id: 'created', name: 'Proyecto' }), upload: vi.fn().mockResolvedValue({ id: 'file', name: 'qa.txt', folder: false, size: 2 }) };
  cloud = new ProjectCloudStorage(async () => port);
});
describe('Carpetas de la cuenta vinculada', () => {
  it('el selector lista archivos y carpetas con capacidades y permite archivos de sólo lectura', async () => {
    vi.mocked(port.children).mockResolvedValue({ items: [{ ...root, id: 'folder', name: 'Diseño' }, { id: 'file', name: 'Guía.pdf', folder: false, mimeType: 'application/pdf' }], next: 'provider-page' });
    port.file = vi.fn().mockResolvedValue({ id: 'file', name: 'Guía actual.pdf', folder: false, mimeType: 'application/pdf' });
    const listing = await cloud.folders({ provider: 'google_drive' }, auth, true);
    expect(port.folder).toHaveBeenCalledWith(undefined, undefined, true);
    expect(port.children).toHaveBeenCalledWith(root, undefined, false);
    expect(listing.files).toHaveLength(1); expect(listing.folders).toHaveLength(1);
    const selectionId = listing.files[0].selectionId;
    expect(selectionId).not.toBe('file');
    expect(await cloud.selectedFile(selectionId, auth)).toMatchObject({ name: 'Guía actual.pdf' });
    await expect(cloud.selectedFile(selectionId, { ...auth, userId: 'ajeno' })).rejects.toThrow();
    await expect(cloud.selectedFile(listing.folders[0].selectionId, auth)).rejects.toThrow();
    await cloud.folders({ provider: 'google_drive', selectionId: listing.selectionId, cursor: listing.nextCursor }, auth, true);
    expect(port.children).toHaveBeenLastCalledWith(root, 'provider-page', false);
  });
  it('crea una carpeta sólo en una selección autorizada y no repite la operación', async () => {
    const listed = await cloud.folders({ provider: 'google_drive' }, auth);
    const input = { provider: 'google_drive' as const, selectionId: listed.selectionId, name: 'Proyecto', operationId: randomUUID() };
    const created = await cloud.createFolder(input, auth);
    expect(created).toMatchObject({ name: 'Proyecto', accountEmail: port.email });
    await expect(cloud.createFolder(input, auth)).rejects.toThrow('ya se envió');
    await expect(cloud.createFolder({ ...input, operationId: randomUUID() }, { ...auth, userId: 'otro' })).rejects.toThrow();
    expect(port.createFolder).toHaveBeenCalledOnce();
  });
  it('devuelve capacidades opacas y la creación conserva cuenta, carpeta y proveedor', async () => {
    const listed = await cloud.folders({ provider: 'google_drive' }, auth);
    expect(listed.accountEmail).toBe(port.email);
    expect(listed.folders[0].selectionId).not.toBe('child-id');
    expect(JSON.stringify(listed)).not.toContain('root-id');
    const prepared = await cloud.prepare('google_drive', listed.folders[0].selectionId, auth);
    expect(await cloud.create(prepared, 'Proyecto', randomUUID())).toMatchObject({ provider: 'google_drive', accountEmail: port.email, folderId: 'created' });
  });
  it('una selección no sirve para otro usuario, proveedor o cuenta', async () => {
    const listed = await cloud.folders({ provider: 'google_drive' }, auth);
    await expect(cloud.prepare('google_drive', listed.selectionId, { ...auth, userId: 'actor-b' })).rejects.toThrow();
    await expect(cloud.prepare('onedrive', listed.selectionId, auth)).rejects.toThrow();
    port = { ...port, email: 'otra@example.test' };
    await expect(cloud.prepare('google_drive', listed.selectionId, auth)).rejects.toThrow();
  });
  it('el cierre del IPC de listado no invalida la cuenta, pero desconectar la cuenta sí', async () => {
    let callerValid = true;
    vi.mocked(port.assertCurrent).mockImplementation(() => { if (!callerValid) throw new Error('Caller anterior retirado'); });
    const listed = await cloud.folders({ provider: 'google_drive' }, auth);
    callerValid = false;
    const accountGuard = port.assertAccount;
    port = { ...port, assertCurrent: vi.fn() };
    // El grant conserva la guarda de cuenta, no la guarda del IPC ya terminado.
    await cloud.prepare('google_drive', listed.selectionId, auth);
    vi.mocked(accountGuard).mockImplementation(() => { throw new Error('Cuenta desconectada'); });
    await expect(cloud.prepare('google_drive', listed.selectionId, auth)).rejects.toThrow();
  });
});

describe('OneDrive directo sin transporte por Soflia', () => {
  const credentials = { token: vi.fn(async () => ({ token: 'credencial-ficticia', email: 'cuenta@outlook.test', assert: vi.fn(), assertAccount: vi.fn() })) } as unknown as MicrosoftFilesAuth;
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  it('lista únicamente en Graph y no sigue un nextLink de otro origen', async () => {
    const request = vi.fn().mockResolvedValue(response({ value: [] }));
    const storage = await oneDriveProjectStorage(credentials, auth, request);
    await expect(storage.children(root, 'https://externo.test/v1.0/drives/drive-id/items/root-id/children')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('sube a una sesión de OneDrive sin reenviar bearer a la URL de contenido', async () => {
    const request = vi.fn().mockResolvedValueOnce(response({ uploadUrl: 'https://test.up.1drv.com/upload/session' })).mockResolvedValueOnce(response({ id: 'file-id', name: 'qa.txt', size: 2, parentReference: { driveId: 'drive-id' } }, 201));
    const storage = await oneDriveProjectStorage(credentials, auth, request);
    expect(await storage.upload(root, 'qa.txt', 'text/plain', Buffer.from('QA'))).toMatchObject({ id: 'file-id', size: 2 });
    expect(request.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ item: { '@microsoft.graph.conflictBehavior': 'fail' } });
    expect(request.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
    expect(request.mock.calls[1][1].headers).toHaveProperty('Content-Range', 'bytes 0-1/2');
  });
  it('rechaza una URL de subida ajena antes de enviar bytes o credenciales', async () => {
    const request = vi.fn().mockResolvedValue(response({ uploadUrl: 'https://externo.test/subir' }));
    const storage = await oneDriveProjectStorage(credentials, auth, request);
    await expect(storage.upload(root, 'qa.txt', 'text/plain', Buffer.from('QA'))).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
