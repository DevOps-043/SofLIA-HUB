import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectLocationFilesService } from '../project-hub/location-files';
import { ProjectLocationStore } from '../project-hub/location-store';
import type { ProjectCloudStorage } from '../project-hub/cloud-storage';
import type { ProjectCreationService } from '../project-hub/project-creation';
import type { ProjectHubApiService } from '../project-hub/service';
import type { ProjectLocation } from '../../src/shared/project-creation';

const target = { workspaceId: randomUUID(), projectId: randomUUID() };
const auth = { userId: 'actor', assertCurrent: () => {}, signal: new AbortController().signal };
let temporary: string;
let location: ProjectLocation;
let files: ProjectLocationFilesService;
let portUpload: ReturnType<typeof vi.fn>;
let legacyUpload: ReturnType<typeof vi.fn>;
let getProject: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  temporary = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'soflia-location-files-')));
  const root = path.join(temporary, 'Proyecto'); await fs.mkdir(root);
  location = { mode: 'local', rootPath: root, additionalFolders: [] };
  const store = new ProjectLocationStore(path.join(temporary, 'private'), { available: async () => true, encrypt: async value => Buffer.from(value), decrypt: async value => ({ result: value.toString(), shouldReEncrypt: false }) });
  portUpload = vi.fn().mockResolvedValue({ id: 'archivo-proveedor', name: 'entrada.txt', size: 4, folder: false });
  legacyUpload = vi.fn(); getProject = vi.fn().mockResolvedValue({ success: true, data: { workspace_id: target.workspaceId, project_id: target.projectId, role: 'owner' } });
  const locations = { location: vi.fn(async () => location) } as unknown as ProjectCreationService;
  const cloud = { stored: vi.fn(async () => ({ port: { upload: portUpload }, folder: { id: 'carpeta-proveedor' } })) } as unknown as ProjectCloudStorage;
  files = new ProjectLocationFilesService(locations, store, cloud, { getProject, uploadFiles: legacyUpload } as unknown as ProjectHubApiService);
  await fs.writeFile(path.join(temporary, 'entrada.txt'), 'Hola');
});
afterEach(async () => {
  if (path.dirname(temporary) !== await fs.realpath(tmpdir()) || !path.basename(temporary).startsWith('soflia-location-files-')) throw new Error('Temporal fuera de alcance.');
  await fs.rm(temporary, { recursive: true, force: true });
});
describe('Archivos en la ubicación del usuario', () => {
  it('copia localmente sin enviar bytes a Storage de Soflia ni a un proveedor', async () => {
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, async () => true)).toMatchObject({ success: true, data: { uploaded: 1 } });
    expect(await fs.readFile(path.join(location.rootPath!, 'entrada.txt'), 'utf8')).toBe('Hola');
    expect(portUpload).not.toHaveBeenCalled(); expect(legacyUpload).not.toHaveBeenCalled();
    expect((await files.list(target, auth)).files).toMatchObject([{ name: 'entrada.txt', size: 4 }]);
  });
  it.each(['google_drive', 'onedrive'] as const)('guarda directamente en %s y no invoca la subida heredada', async provider => {
    location = { mode: provider, additionalFolders: [], cloud: { provider, accountEmail: 'cuenta@example.test', folderId: 'carpeta-proveedor', name: 'Proyecto' } };
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, async () => true)).toMatchObject({ success: true, data: { uploaded: 1 } });
    expect(portUpload).toHaveBeenCalledWith({ id: 'carpeta-proveedor' }, 'entrada.txt', 'text/plain', Buffer.from('Hola'));
    expect(legacyUpload).not.toHaveBeenCalled();
  });
  it('cancelar la revisión no escribe y un lector no puede iniciar una copia', async () => {
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, async () => false)).toMatchObject({ cancelled: true });
    expect(await fs.readdir(location.rootPath!)).toEqual([]);
    getProject.mockResolvedValue({ success: true, data: { workspace_id: target.workspaceId, project_id: target.projectId, role: 'viewer' } });
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, async () => true)).toMatchObject({ success: false });
    expect(await fs.readdir(location.rootPath!)).toEqual([]);
    getProject.mockResolvedValue({ success: true, data: { workspace_id: target.workspaceId, project_id: target.projectId, role: 'owner' } });
    const approve = async () => { getProject.mockResolvedValue({ success: true, data: { workspace_id: target.workspaceId, project_id: target.projectId, role: 'viewer' } }); return true; };
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, approve)).toMatchObject({ success: false });
    expect(await fs.readdir(location.rootPath!)).toEqual([]);
  });
  it('una colisión conserva el archivo original y no deja copias parciales visibles', async () => {
    await fs.writeFile(path.join(location.rootPath!, 'entrada.txt'), 'conservar');
    expect(await files.upload({ ...target, operationId: randomUUID() }, [path.join(temporary, 'entrada.txt')], auth, async () => true)).toMatchObject({ success: false });
    expect(await fs.readFile(path.join(location.rootPath!, 'entrada.txt'), 'utf8')).toBe('conservar');
    expect(await fs.readdir(location.rootPath!)).toEqual(['entrada.txt']);
  });
});
