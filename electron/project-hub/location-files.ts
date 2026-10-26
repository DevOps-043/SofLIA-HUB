import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { ProjectCreationInputs, ProjectLocation, ProjectLocationFiles } from '../../src/shared/project-creation';
import type { ProjectUploadProgress, ProjectUploadResult } from '../../src/shared/project-hub-files';
import { openProjectUploadFiles } from './upload-files';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { ProjectCreationService } from './project-creation';
import type { ProjectLocationStore } from './location-store';
import type { ProjectCloudStorage } from './cloud-storage';
import type { ProjectHubApiService } from './service';
import { randomUUID } from 'node:crypto';

export class ProjectLocationFilesService {
  constructor(private readonly locations: ProjectCreationService, private readonly store: ProjectLocationStore, private readonly cloud: ProjectCloudStorage, private readonly backend: ProjectHubApiService) {}
  private async writable(input: ProjectCreationInputs['uploadLocationFiles'], auth: ProjectHubOperationAuthorization) {
    const project = await this.backend.getProject(input, auth); auth.assertCurrent();
    const current = z.object({ project_id: z.string(), workspace_id: z.string(), role: z.string().optional(), membership: z.object({ project_role: z.string() }).optional() }).safeParse(project.data);
    if (!project.success || !current.success || current.data.project_id !== input.projectId || current.data.workspace_id !== input.workspaceId || !['owner', 'admin', 'member'].includes(current.data.role ?? current.data.membership?.project_role ?? '')) throw new Error('No tienes permiso para añadir archivos a este proyecto.');
  }
  private async root(location: ProjectLocation, auth: ProjectHubOperationAuthorization) {
    if (location.mode !== 'local' || !location.rootPath || await fs.realpath(location.rootPath) !== location.rootPath || !(await fs.lstat(location.rootPath)).isDirectory()) throw new Error('La carpeta del proyecto ya no está disponible.');
    auth.assertCurrent(); return location.rootPath;
  }
  async list(target: ProjectCreationInputs['locationFiles'], auth: ProjectHubOperationAuthorization): Promise<ProjectLocationFiles> {
    const location = await this.locations.location(target, auth);
    if (!location || location.mode === 'cloud') return { location, files: [], partial: false };
    if (location.cloud) {
      const current = await this.cloud.stored(location.cloud, auth);
      const page = await current.port.children(current.folder, undefined, false);
      return { location, files: page.items.filter(item => !item.folder && item.name !== '.soflia-project.json').map(item => ({ id: item.id, name: item.name, size: item.size ?? 0, webUrl: item.webUrl })), partial: !!page.next };
    }
    const directory = await fs.opendir(await this.root(location, auth));
    const files: ProjectLocationFiles['files'] = []; let scanned = 0; let partial = false;
    for await (const entry of directory) {
      auth.assertCurrent();
      if (++scanned > 5000 || files.length >= 200) { partial = true; break; }
      if (!entry.isFile() || entry.isSymbolicLink() || entry.name.startsWith('.soflia')) continue;
      const stat = await fs.lstat(path.join(location.rootPath!, entry.name)); auth.assertCurrent();
      if (stat.isFile() && !stat.isSymbolicLink()) files.push({ id: entry.name, name: entry.name, size: stat.size });
    }
    return { location, files, partial };
  }
  async upload(input: ProjectCreationInputs['uploadLocationFiles'], paths: string[], auth: ProjectHubOperationAuthorization, approve: (files: ReadonlyArray<{ name: string; size: number }>, location: ProjectLocation) => Promise<boolean>): Promise<ProjectUploadResult> {
    const progress: ProjectUploadProgress = { requested: paths.length, prepared: 0, stored: 0, uploaded: 0 };
    const opened: Awaited<ReturnType<typeof openProjectUploadFiles>> = [];
    let effects = false;
    try {
      await this.writable(input, auth);
      const location = await this.locations.location(input, auth);
      if (!location || location.mode === 'cloud') throw new Error('Este proyecto necesita una ubicación local, Google Drive o OneDrive.');
      const remote = location.cloud ? await this.cloud.stored(location.cloud, auth) : null;
      const root = remote ? null : await this.root(location, auth);
      if (await this.store.read(auth.userId, `file-operation/${input.operationId}`, auth.assertCurrent)) throw new Error('Esta selección ya se procesó. Actualiza los archivos antes de repetir.');
      opened.push(...await openProjectUploadFiles(paths, auth.assertCurrent));
      if (!await approve(opened.map(file => file.declaration), location)) return { success: false, cancelled: true, data: progress };
      auth.assertCurrent();
      await this.store.write(auth.userId, `file-operation/${input.operationId}`, { state: 'pending', workspaceId: input.workspaceId, projectId: input.projectId, names: opened.map(file => file.declaration.name) }, auth.assertCurrent);
      for (const file of opened) {
        // La revisión humana puede durar: comprobar de nuevo antes de cada escritura.
        await this.writable(input, auth);
        const bytes = await file.bytes(auth.assertCurrent); auth.assertCurrent(); progress.prepared++;
        if (remote) {
          effects = true;
          await remote.port.upload(remote.folder, file.declaration.name, file.declaration.mime_type, bytes);
        } else {
          await this.root(location, auth); auth.assertCurrent();
          // wx rechaza colisiones y enlaces; nunca sustituye un archivo existente.
          const temporary = path.join(root!, `.soflia-upload-${randomUUID()}.part`);
          const output = await fs.open(temporary, 'wx', 0o600);
          effects = true;
          try {
            try { await output.writeFile(bytes); await output.sync(); } finally { await output.close(); }
            auth.assertCurrent(); await this.root(location, auth);
            await fs.link(temporary, path.join(root!, file.declaration.name));
          } finally { await fs.unlink(temporary).catch(() => {}); }
        }
        auth.assertCurrent(); progress.stored++; progress.uploaded++;
      }
      await this.store.write(auth.userId, `file-operation/${input.operationId}`, { state: 'complete', ...progress }, auth.assertCurrent);
      return { success: true, data: progress };
    } catch (error) {
      return { success: false, data: progress, error: error instanceof Error && !('code' in error) ? error.message : 'No se pudo guardar la selección en su destino. Revisa los archivos antes de repetir.', partial: progress.uploaded > 0, uncertain: effects, recoveryRequired: effects, ...(auth.signal?.aborted ? { cancelled: true } : {}) };
    } finally { await Promise.allSettled(opened.map(file => file.close())); }
  }
}
