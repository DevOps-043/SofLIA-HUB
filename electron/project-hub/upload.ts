import { PROJECT_UPLOAD_BUDGET_MS, type ProjectUploadDeclaration, type ProjectUploadProgress, type ProjectUploadResult } from '../../src/shared/project-hub-files';
import { openProjectUploadFiles } from './upload-files';
import { projectStorageOrigin, projectUploadTarget, putProjectUpload } from './upload-target';
import { ProjectHubError } from './session-contract';
import type { ProjectHubOperationAuthorization, ProjectHubSessionLease } from './session-context';
import type { ProjectHubApiService } from './service';
import { z } from 'zod';
import { createLogger } from '../utils/logger';

const log = createLogger('project-hub-subida');
const completedSchema = z.object({ evidence_id: z.string().uuid(), workspace_id: z.string().uuid(), project_id: z.string().uuid(),
  metadata: z.object({ upload_state: z.literal('ready') }) });

export interface ProjectHubUploadAuthorization extends ProjectHubOperationAuthorization {
  approve(files: readonly ProjectUploadDeclaration[]): Promise<boolean>;
}
export interface ProjectHubNativeUpload { workspaceId: string; projectId: string; paths: string[] }
type UploadBackend = Pick<ProjectHubApiService, 'createUploadIntent' | 'completeUpload'>;

export async function uploadProjectFiles(input: ProjectHubNativeUpload, backend: UploadBackend,
  authorization: ProjectHubUploadAuthorization, lease: ProjectHubSessionLease, configuredStorage: string): Promise<ProjectUploadResult> {
  const progress: ProjectUploadProgress = { requested: input.paths.length, prepared: 0, stored: 0, uploaded: 0 };
  const files: Awaited<ReturnType<typeof openProjectUploadFiles>> = [];
  let effectPending = false, effectStarted = false, timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new AbortController();
  const signal = AbortSignal.any([lease.signal, budget.signal]);
  const assert = () => { lease.assert(); if (budget.signal.aborted) throw new ProjectHubError('TIMEOUT', 'Se agotó el tiempo de subida.'); };
  const auth: ProjectHubOperationAuthorization = { userId: lease.userId, signal, assertCurrent: assert };
  try {
    assert(); const origin = projectStorageOrigin(configuredStorage);
    if (!origin) throw new ProjectHubError('STORAGE_NOT_CONFIGURED', 'El destino de archivos Project Hub no está configurado.');
    files.push(...await openProjectUploadFiles(input.paths, assert)); assert();
    const declarations = files.map(file => ({ ...file.declaration }));
    if (!await authorization.approve(declarations)) return { success: false, cancelled: true, code: 'CANCELLED', data: progress };
    assert(); timer = setTimeout(() => budget.abort(), PROJECT_UPLOAD_BUDGET_MS);
    const used = new Set<string>();
    for (const file of files) {
      assert(); const bytes = await file.bytes(assert); assert();
      effectStarted = true; effectPending = true;
      const result = await backend.createUploadIntent({ workspaceId: input.workspaceId, projectId: input.projectId, files: [{ ...file.declaration }] }, auth);
      assert();
      if (!result.success) throw new ProjectHubError('UPLOAD_INTENT_FAILED', 'No se confirmó la preparación del archivo.');
      const target = projectUploadTarget(result.data, origin, input.workspaceId, input.projectId, file.extension);
      if (used.has(target.evidenceId.toLowerCase())) throw new ProjectHubError('INVALID_UPLOAD_TARGET', 'La intención de archivo ya fue usada.');
      used.add(target.evidenceId.toLowerCase()); progress.prepared++; effectPending = false;
      assert(); effectPending = true;
      await putProjectUpload(target.url, bytes, file.declaration.mime_type, { signal, assert }); assert();
      progress.stored++; effectPending = false;
      assert(); effectPending = true;
      const completed = await backend.completeUpload({ workspaceId: input.workspaceId, projectId: input.projectId, evidenceId: target.evidenceId }, auth); assert();
      const data = completedSchema.safeParse(completed.data);
      if (!completed.success || !data.success || data.data.evidence_id.toLowerCase() !== target.evidenceId.toLowerCase()
        || data.data.workspace_id.toLowerCase() !== input.workspaceId.toLowerCase() || data.data.project_id.toLowerCase() !== input.projectId.toLowerCase()) {
        throw new ProjectHubError('UPLOAD_COMPLETE_FAILED', 'No se confirmó la validación del archivo.');
      }
      progress.uploaded++; effectPending = false;
    }
    return { success: true, data: progress };
  } catch (error) {
    return { success: false, data: progress, code: error instanceof ProjectHubError ? error.code : 'UPLOAD_FAILED',
      error: 'No se completó la subida. Revisa los archivos confirmados y pendientes antes de volver a intentarlo.',
      ...(signal.aborted ? { cancelled: true } : {}), ...(progress.uploaded ? { partial: true } : {}),
      ...(effectPending ? { uncertain: true } : {}), ...(effectStarted ? { recoveryRequired: true } : {}) };
  } finally {
    if (timer) clearTimeout(timer); budget.abort();
    const closing = await Promise.allSettled(files.map(file => file.close()));
    if (closing.some(result => result.status === 'rejected')) log.warn('No se confirmó el cierre de todos los archivos de subida.');
  }
}
