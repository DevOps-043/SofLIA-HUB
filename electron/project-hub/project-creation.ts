import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { projectDirectoryName, type ProjectCreationInputs, type ProjectFolderSelection, type ProjectLocation, type ProjectOrganization } from '../../src/shared/project-creation';
import type { ProjectHubApiService } from './service';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { ProjectHubProject, ProjectHubResult } from './types';
import { ProjectLocationStore } from './location-store';
import { onAuthStateChange } from '../main/auth-state';
import type { ProjectCloudStorage } from './cloud-storage';

const SELECTION_TTL = 15 * 60_000;
const locationSchema = z.object({ mode: z.enum(['local', 'cloud', 'google_drive', 'onedrive']), rootPath: z.string().optional(), additionalFolders: z.array(z.string()).max(10), cloud: z.object({ provider: z.enum(['google_drive', 'onedrive']), accountEmail: z.string().max(320), folderId: z.string().max(512), driveId: z.string().max(512).optional(), name: z.string().max(1024), webUrl: z.string().url().optional() }).strict().optional() }).strict();
interface Selection { path: string; owner: string; device: number; inode: number; expires: number }
interface Dependencies {
  store: Pick<ProjectLocationStore, 'read' | 'write'>;
  defaultDirectory: string;
  service: Pick<ProjectHubApiService, 'createProject' | 'getProject'>;
  resolveOrganization: (id: string, auth: ProjectHubOperationAuthorization) => Promise<ProjectOrganization>;
  cloud?: ProjectCloudStorage;
}

/** Selector y creación del proyecto; no enumera archivos ni publica carpetas vinculadas. */
export class ProjectCreationService {
  private readonly selections = new Map<string, Selection>();
  private readonly pending = new Set<string>();
  private readonly unsubscribe: () => void;
  constructor(private readonly dependencies: Dependencies) {
    this.unsubscribe = onAuthStateChange(() => this.selections.clear());
  }
  dispose() { this.unsubscribe(); this.selections.clear(); }

  async selectFolder(requested: string, auth: ProjectHubOperationAuthorization): Promise<ProjectFolderSelection> {
    auth.assertCurrent();
    if (!path.isAbsolute(requested) || requested.startsWith('\\\\')) throw new Error('Elige una carpeta local o sincronizada disponible en este equipo.');
    const current = await fs.realpath(requested);
    if (current.startsWith('\\\\')) throw new Error('Elige una carpeta disponible en este equipo.');
    const stat = await fs.stat(current);
    if (!stat.isDirectory()) throw new Error('La ubicación no es una carpeta.');
    auth.assertCurrent();
    const now = Date.now();
    for (const [key, value] of this.selections) if (value.expires < now || value.owner !== auth.userId) this.selections.delete(key);
    if (this.selections.size >= 200) this.selections.delete(this.selections.keys().next().value!);
    const selectionId = randomUUID();
    this.selections.set(selectionId, { path: current, owner: auth.userId, device: stat.dev, inode: stat.ino, expires: now + SELECTION_TTL });
    return { selectionId, path: current, name: path.basename(current) || current };
  }

  private async selected(id: string, auth: ProjectHubOperationAuthorization) {
    const selection = this.selections.get(id);
    if (!selection || selection.owner !== auth.userId || selection.expires < Date.now()) throw new Error('Vuelve a elegir la carpeta para comprobar su ubicación.');
    const canonical = await fs.realpath(selection.path);
    const stat = await fs.lstat(selection.path);
    auth.assertCurrent();
    if (canonical !== selection.path || !stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== selection.device || stat.ino !== selection.inode) throw new Error('La carpeta cambió. Selecciónala de nuevo.');
    return selection.path;
  }

  async create(input: ProjectCreationInputs['createConfigured'], auth: ProjectHubOperationAuthorization): Promise<ProjectHubResult<ProjectHubProject>> {
    const lock = auth.userId;
    if (this.pending.has(lock)) return { success: false, error: 'Ya se está creando un proyecto. Espera a que termine.' };
    this.pending.add(lock);
    let sending = false;
    let rootPath: string | undefined;
    let project: ProjectHubProject | undefined;
    const operationKey = `operation/${input.operationId}`;
    const { store, service } = this.dependencies;
    try {
      auth.assertCurrent();
      const previous = await store.read(auth.userId, operationKey, auth.assertCurrent);
      const rejected = z.object({ state: z.literal('rejected'), organizationId: z.string(), workspaceId: z.string(), name: z.string(), location: locationSchema }).safeParse(previous);
      const resuming = !!previous && rejected.success && rejected.data.location.mode === 'local' && input.storage.mode === 'local';
      if (previous && !resuming) return { success: false, uncertain: true, recoveryRequired: true, error: 'Esta solicitud ya fue registrada. Actualiza los proyectos antes de volver a crearla.' };
      const organization = await this.dependencies.resolveOrganization(input.organizationId, auth);
      const cloud = input.storage.mode !== 'local' ? await this.dependencies.cloud?.prepare(input.storage.mode, input.storage.parentSelectionId, auth) : undefined;
      if (input.storage.mode !== 'local' && !cloud) throw new Error('Selecciona una carpeta de tu cuenta de Drive o OneDrive.');
      const additionalFolders = await Promise.all(input.additionalSelectionIds.map(id => this.selected(id, auth)));
      const preparedManifest = JSON.stringify({ schema_version: 1, operation_id: input.operationId, name: input.name, organization_id: input.organizationId, state: 'pending' }, null, 2);
      if (new Set(additionalFolders.map(value => process.platform === 'win32' ? value.toLowerCase() : value)).size !== additionalFolders.length) throw new Error('No añadas la misma carpeta más de una vez.');
      if (input.storage.mode === 'local') {
        const parent = await this.selected(input.storage.parentSelectionId, auth);
        rootPath = path.join(parent, projectDirectoryName(input.name));
        if (additionalFolders.some(folder => folder === rootPath || folder.startsWith(rootPath + path.sep) || rootPath!.startsWith(folder + path.sep))) throw new Error('Las carpetas adicionales deben estar fuera de la carpeta principal.');
        if (resuming && rejected.success) {
          const receipt = rejected.data;
          if (receipt.name !== input.name || receipt.organizationId !== input.organizationId || receipt.workspaceId !== organization.workspaceId || receipt.location.rootPath !== rootPath || JSON.stringify(receipt.location.additionalFolders) !== JSON.stringify(additionalFolders)) throw new Error('La configuración cambió. Vuelve a seleccionar la ubicación.');
          const metadata = path.join(rootPath, '.soflia'); const manifest = path.join(metadata, 'project.json');
          if (await fs.realpath(rootPath) !== rootPath || !(await fs.lstat(rootPath)).isDirectory() || await fs.realpath(metadata) !== metadata || !(await fs.lstat(metadata)).isDirectory()) throw new Error('La carpeta preparada cambió.');
          const stat = await fs.lstat(manifest);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384 || await fs.readFile(manifest, 'utf8') !== preparedManifest) throw new Error('El manifiesto fue modificado. No se puede reutilizar esta carpeta.');
          auth.assertCurrent();
        } else {
          try { await fs.lstat(rootPath); throw new Error('Ya existe una carpeta con ese nombre. Cambia el nombre del proyecto o elige otra ubicación.'); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        }
      }
      const location: ProjectLocation = { mode: input.storage.mode, ...(rootPath ? { rootPath } : {}), additionalFolders };
      const receipt = { organizationId: input.organizationId, workspaceId: organization.workspaceId, name: input.name, location };
      // Diario antes del primer efecto: un crash no autoriza reenviar el POST.
      await store.write(auth.userId, operationKey, { ...receipt, state: 'preparing' }, auth.assertCurrent);
      if (rootPath && !resuming) {
        await fs.mkdir(rootPath); // Exclusiva; no adopta ni sobrescribe contenido existente.
        auth.assertCurrent();
        await fs.mkdir(path.join(rootPath, '.soflia'));
        await fs.writeFile(path.join(rootPath, '.soflia', 'project.json'), preparedManifest, { flag: 'wx', mode: 0o600 });
      }
      if (cloud) {
        sending = true;
        location.cloud = await this.dependencies.cloud!.create(cloud, projectDirectoryName(input.name), input.operationId);
        await store.write(auth.userId, operationKey, { ...receipt, state: 'provider-folder-created' }, auth.assertCurrent);
      }
      await store.write(auth.userId, operationKey, { ...receipt, state: 'sending' }, auth.assertCurrent);
      auth.assertCurrent();
      sending = true;
      const result = await service.createProject({ workspaceId: organization.workspaceId, project: { name: input.name, priority: 'medium', tags: [] } }, auth);
      auth.assertCurrent();
      if (!result.success || !result.data) {
        const uncertain = result.success || result.uncertain || result.recoveryRequired || ['TIMEOUT', 'UNAVAILABLE', 'INVALID_RESPONSE', 'SESSION_CHANGED'].includes(result.code || '') || /^HTTP_5\d\d$/.test(result.code || '');
        await store.write(auth.userId, operationKey, { ...receipt, state: uncertain ? 'uncertain' : 'rejected' }, auth.assertCurrent);
        return { ...result, success: false, uncertain: Boolean(uncertain), recoveryRequired: Boolean(uncertain || cloud), error: `${result.error || 'No se pudo crear el proyecto.'}${rootPath ? ' La carpeta preparada se conserva en el equipo.' : cloud ? ' La carpeta preparada se conserva en tu cuenta.' : ''}` };
      }
      project = result.data;
      if (!z.string().uuid().safeParse(project.project_id).success || project.workspace_id !== organization.workspaceId) throw new Error('No se pudo verificar el proyecto creado.');
      await store.write(auth.userId, `project/${project.workspace_id}/${project.project_id}`, location, auth.assertCurrent);
      await store.write(auth.userId, operationKey, { ...receipt, state: 'created', projectId: project.project_id }, auth.assertCurrent);
      if (rootPath) {
        auth.assertCurrent();
        const metadataPath = path.join(rootPath, '.soflia');
        if (await fs.realpath(metadataPath) !== metadataPath || !(await fs.lstat(metadataPath)).isDirectory()) throw new Error('La ubicación cambió durante la creación.');
        const manifest = path.join(metadataPath, 'project.json');
        const manifestStat = await fs.lstat(manifest);
        if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 16_384) throw new Error('El manifiesto cambió durante la creación.');
        if (await fs.readFile(manifest, 'utf8') !== preparedManifest) throw new Error('El manifiesto fue modificado.');
        const temporary = path.join(metadataPath, `${randomUUID()}.tmp`);
        await fs.writeFile(temporary, JSON.stringify({ schema_version: 1, operation_id: input.operationId, project_id: project.project_id, workspace_id: project.workspace_id, organization_id: input.organizationId, name: input.name, state: 'active' }, null, 2), { flag: 'wx', mode: 0o600 });
        auth.assertCurrent();
        await fs.rename(temporary, manifest);
      }
      auth.assertCurrent();
      return result;
    } catch (error) {
      // Nunca compensa borrando carpetas ni declara rollback de una escritura remota.
      return { success: false, uncertain: sending, recoveryRequired: sending, error: project ? 'El proyecto fue creado, pero su ubicación requiere revisión. Actualiza la lista antes de repetir.' : sending ? 'No se pudo completar la configuración. Revisa la lista y la carpeta elegida antes de crear otro proyecto.' : error instanceof Error ? error.message : 'No se pudo preparar el proyecto.' };
    } finally { this.pending.delete(lock); }
  }

  async location(input: ProjectCreationInputs['getLocation'], auth: ProjectHubOperationAuthorization): Promise<ProjectLocation | null> {
    const project = await this.dependencies.service.getProject(input, auth);
    auth.assertCurrent();
    if (!project.success || project.data?.project_id !== input.projectId || project.data.workspace_id !== input.workspaceId) throw new Error('No se pudo comprobar el acceso al proyecto.');
    const stored = await this.dependencies.store.read(auth.userId, `project/${input.workspaceId}/${input.projectId}`, auth.assertCurrent);
    return stored ? locationSchema.parse(stored) : null;
  }
}
