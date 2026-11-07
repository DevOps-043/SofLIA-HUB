import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCreationService } from '../project-hub/project-creation';
import { ProjectLocationStore } from '../project-hub/location-store';
import { projectCreationInputs, projectDirectoryName } from '../../src/shared/project-creation';
import type { ProjectCloudStorage } from '../project-hub/cloud-storage';
import type { ProjectHubApiService } from '../project-hub/service';

const org = randomUUID(), workspace = randomUUID(), projectId = randomUUID();
const cloudBackend = { prepare: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ provider: 'google_drive', accountEmail: 'demo@example.test', folderId: 'root-project', name: 'Proyecto QA' }) };
const auth = { userId: 'usuario-a', assertCurrent: () => {}, signal: new AbortController().signal };
const project = { project_id: projectId, workspace_id: workspace, project_name: 'Proyecto QA' };
let temporary: string;
let creation: ProjectCreationService;
let create: ReturnType<typeof vi.fn>;
let store: ProjectLocationStore;
beforeEach(async () => {
  temporary = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'soflia-creation-test-')));
  store = new ProjectLocationStore(path.join(temporary, 'private'), { available: async () => true, encrypt: async value => Buffer.from(value), decrypt: async value => ({ result: value.toString(), shouldReEncrypt: false }) });
  create = vi.fn().mockResolvedValue({ success: true, data: project });
  creation = new ProjectCreationService({ store, cloud: cloudBackend as unknown as ProjectCloudStorage, defaultDirectory: temporary, service: { createProject: create, getProject: vi.fn().mockResolvedValue({ success: true, data: project }) } as unknown as ProjectHubApiService, resolveOrganization: vi.fn().mockResolvedValue({ workspaceId: workspace, name: 'Organización A', role: 'owner' }) });
});
afterEach(async () => {
  creation.dispose();
  const parent = await fs.realpath(tmpdir());
  if (path.dirname(temporary) !== parent || !path.basename(temporary).startsWith('soflia-creation-test-')) throw new Error('Ruta temporal inesperada.');
  await fs.rm(temporary, { recursive: true, force: true });
});
const cloud = () => ({ operationId: randomUUID(), organizationId: org, name: 'Proyecto QA', storage: { mode: 'google_drive' as const, parentSelectionId: org }, additionalSelectionIds: [] });

describe('Ubicación de proyectos y creación recuperable', () => {
  it('un rechazo confirmado permite reintento explícito reutilizando sólo su carpeta intacta', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    const input = { ...cloud(), storage: { mode: 'local' as const, parentSelectionId: parent.selectionId } };
    create.mockResolvedValueOnce({ success: false, code: 'HTTP_422', error: 'TEAM_REQUIRED' });
    expect(await creation.create(input, auth)).toMatchObject({ success: false, uncertain: false });
    expect(await creation.create(input, auth)).toMatchObject({ success: true });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('no reutiliza el manifiesto editado de una creación rechazada', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    const input = { ...cloud(), storage: { mode: 'local' as const, parentSelectionId: parent.selectionId } };
    create.mockResolvedValueOnce({ success: false, code: 'HTTP_422' });
    await creation.create(input, auth);
    await fs.writeFile(path.join(temporary, input.name, '.soflia', 'project.json'), 'conservar');
    expect(await creation.create(input, auth)).toMatchObject({ success: false, error: expect.stringContaining('modificado') });
    expect(create).toHaveBeenCalledOnce();
  });
  it('crea una subcarpeta exclusiva y persiste vínculos privados sin publicar rutas', async () => {
    const extra = path.join(temporary, 'Referencias'); await fs.mkdir(extra);
    const parent = await creation.selectFolder(temporary, auth), additional = await creation.selectFolder(extra, auth);
    const result = await creation.create({ ...cloud(), storage: { mode: 'local', parentSelectionId: parent.selectionId }, additionalSelectionIds: [additional.selectionId] }, auth);
    expect(result.success).toBe(true);
    const manifest = JSON.parse(await fs.readFile(path.join(temporary, 'Proyecto QA', '.soflia', 'project.json'), 'utf8'));
    expect(manifest).toMatchObject({ project_id: projectId, workspace_id: workspace, organization_id: org, state: 'active' });
    expect(JSON.stringify(manifest)).not.toContain(temporary.replace(/\\/g, '\\\\'));
    expect(create).toHaveBeenCalledWith({ workspaceId: workspace, project: { name: 'Proyecto QA', priority: 'medium', tags: [] } }, auth);
    expect(await creation.location({ workspaceId: workspace, projectId }, auth)).toEqual({ mode: 'local', rootPath: path.join(temporary, 'Proyecto QA'), additionalFolders: [extra] });
    expect(await fs.readdir(extra)).toEqual([]);
    expect(await creation.location({ workspaceId: workspace, projectId }, { ...auth, userId: 'usuario-b' })).toBeNull();
  });
  it('nube no prepara una carpeta principal y no reenvía una operación registrada', async () => {
    const input = cloud();
    expect((await creation.create(input, auth)).success).toBe(true);
    expect(await fs.readdir(temporary)).toEqual(['private']);
    expect(await creation.create(input, auth)).toMatchObject({ success: false, uncertain: true });
    expect(create).toHaveBeenCalledOnce();
  });
  it('rechaza una carpeta existente sin tocar sus archivos ni enviar negocio', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    await fs.mkdir(path.join(temporary, 'Proyecto QA'));
    await fs.writeFile(path.join(temporary, 'Proyecto QA', 'original.txt'), 'conservar');
    expect(await creation.create({ ...cloud(), storage: { mode: 'local', parentSelectionId: parent.selectionId } }, auth)).toMatchObject({ success: false, uncertain: false, error: expect.stringContaining('Ya existe') });
    expect(await fs.readFile(path.join(temporary, 'Proyecto QA', 'original.txt'), 'utf8')).toBe('conservar');
    expect(create).not.toHaveBeenCalled();
  });
  it('una selección de otro usuario o una carpeta desaparecida no autoriza la creación', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    expect((await creation.create({ ...cloud(), storage: { mode: 'local', parentSelectionId: parent.selectionId } }, { ...auth, userId: 'usuario-b' })).success).toBe(false);
    const selectedPath = path.join(temporary, 'Borrada'); await fs.mkdir(selectedPath);
    const selected = await creation.selectFolder(selectedPath, auth); await fs.rmdir(selectedPath);
    expect((await creation.create({ ...cloud(), storage: { mode: 'local', parentSelectionId: selected.selectionId } }, auth)).success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it('conserva la carpeta y bloquea el reenvío tras perder la respuesta remota', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    create.mockResolvedValue({ success: false, code: 'TIMEOUT', error: 'Sin respuesta' });
    const input = { ...cloud(), storage: { mode: 'local' as const, parentSelectionId: parent.selectionId } };
    expect(await creation.create(input, auth)).toMatchObject({ success: false, uncertain: true, recoveryRequired: true });
    expect((await fs.stat(path.join(temporary, 'Proyecto QA'))).isDirectory()).toBe(true);
    expect(await creation.create(input, auth)).toMatchObject({ uncertain: true });
    expect(create).toHaveBeenCalledOnce();
  });
  it('no sobrescribe un manifiesto modificado durante la petición', async () => {
    const parent = await creation.selectFolder(temporary, auth);
    const manifest = path.join(temporary, 'Proyecto QA', '.soflia', 'project.json');
    create.mockImplementation(async () => { await fs.writeFile(manifest, '{"edicion":"conservar"}'); return { success: true, data: project }; });
    expect(await creation.create({ ...cloud(), storage: { mode: 'local', parentSelectionId: parent.selectionId } }, auth)).toMatchObject({ success: false, uncertain: true });
    expect(await fs.readFile(manifest, 'utf8')).toBe('{"edicion":"conservar"}');
  });
  it('rechaza respuestas de otro workspace y no guarda su ubicación', async () => {
    create.mockResolvedValue({ success: true, data: { ...project, workspace_id: randomUUID() } });
    expect(await creation.create(cloud(), auth)).toMatchObject({ success: false, uncertain: true });
    expect(await creation.location({ workspaceId: workspace, projectId }, auth)).toBeNull();
  });
  it('una respuesta de éxito sin identidad se trata como incierta', async () => {
    create.mockResolvedValue({ success: true });
    const input = cloud();
    expect(await creation.create(input, auth)).toMatchObject({ success: false, uncertain: true });
    expect(await creation.create(input, auth)).toMatchObject({ success: false, uncertain: true });
    expect(create).toHaveBeenCalledOnce();
  });
  it('lista sólo directorios, sin archivos ni lectura de contenido', async () => {
    await fs.mkdir(path.join(temporary, 'Visible')); await fs.writeFile(path.join(temporary, 'privado.txt'), 'no enumerar');
    const listing = await creation.selectFolder(temporary, auth);
    expect(listing.path).toBe(temporary);
    expect(listing).not.toHaveProperty('folders');
    expect(await fs.readdir(temporary)).toHaveLength(2);
  });
  it('valida contratos estrictos y nombres compatibles con Windows', () => {
    expect(projectCreationInputs.createConfigured.safeParse({ ...cloud(), workspaceId: workspace }).success).toBe(false);
    expect(projectCreationInputs.createConfigured.safeParse({ ...cloud(), storage: { mode: 'local', path: temporary } }).success).toBe(false);
    expect(projectDirectoryName('../../CON: nuevo?')).not.toMatch(/[/\\:?]/);
    expect(projectDirectoryName('CON')).toBe('Proyecto-CON');
  });
});
