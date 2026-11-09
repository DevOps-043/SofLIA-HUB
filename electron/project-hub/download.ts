import { createHash } from 'node:crypto';
import { PROJECT_DOWNLOAD_BUDGET_MS, PROJECT_DOWNLOAD_TIMEOUT_MS, PROJECT_UPLOAD_MAX_BYTES, type ProjectDownloadResult } from '../../src/shared/project-hub-files';
import { ProjectHubError } from './session-contract';
import type { ProjectHubOperationAuthorization, ProjectHubSessionLease } from './session-context';
import type { ProjectHubApiService } from './service';
import { projectStorageOrigin } from './storage-target';
import { projectDownloadDescription, projectDownloadUrl, type ProjectDownloadDescription } from './download-target';
import { prepareProjectDownloadDestination } from './download-destination';
import { ProjectFileContentValidator } from './file-format';

export interface ProjectHubDownloadTarget { workspaceId: string; projectId: string; evidenceId: string }
export interface ProjectHubDownloadAuthorization extends ProjectHubOperationAuthorization {
  chooseDestination(file: Readonly<ProjectDownloadDescription>): Promise<string | null>;
}
type Backend = Pick<ProjectHubApiService, 'getEvidence' | 'getDownload'>;
export async function downloadProjectFile(input: ProjectHubDownloadTarget, backend: Backend, authorization: ProjectHubDownloadAuthorization,
  lease: ProjectHubSessionLease, configuredStorage: string): Promise<ProjectDownloadResult> {
  const budget = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  let saved = false, bytes = 0;
  const signal = AbortSignal.any([lease.signal, budget.signal]);
  const assert = () => { lease.assert(); if (budget.signal.aborted) throw new ProjectHubError('TIMEOUT', 'Se agotó el tiempo de descarga.'); };
  const auth = { userId: lease.userId, signal, assertCurrent: assert };
  try {
    assert(); const origin = projectStorageOrigin(configuredStorage);
    if (!origin) throw new ProjectHubError('STORAGE_NOT_CONFIGURED', 'El destino de archivos Project Hub no está configurado.');
    const evidence = await backend.getEvidence(input, auth); assert();
    if (!evidence.success) throw new ProjectHubError('DOWNLOAD_DENIED', 'No se pudo consultar la evidencia.');
    const file = projectDownloadDescription(evidence.data, input);
    const selected = await authorization.chooseDestination({ ...file }); assert();
    if (!selected) return { success: false, cancelled: true, data: { saved: false, bytes: 0 } };
    timer = setTimeout(() => budget.abort(), PROJECT_DOWNLOAD_BUDGET_MS);
    const destination = await prepareProjectDownloadDestination(selected, file.mime, assert); assert();
    const signed = await backend.getDownload(input, auth); assert();
    if (!signed.success) throw new ProjectHubError('DOWNLOAD_DENIED', 'No se pudo autorizar la descarga.');
    const url = projectDownloadUrl(signed.data, origin, file);
    const content = await readProjectDownload(url, file, { signal, assert }); assert();
    await destination.publish(content, () => { saved = true; bytes = content.length; }); assert();
    return { success: true, data: { saved, bytes } };
  } catch (error) {
    const uncertain = error instanceof ProjectHubError && error.code === 'DOWNLOAD_COMMIT_UNCERTAIN';
    return { success: false, data: { saved, bytes }, code: error instanceof ProjectHubError ? error.code : 'DOWNLOAD_FAILED',
      error: error instanceof ProjectHubError && error.code === 'DESTINATION_EXISTS' ? error.message
        : 'No se completó la descarga. Comprueba el archivo y el destino antes de volver a intentarlo.',
      ...(signal.aborted ? { cancelled: true } : {}), ...(uncertain ? { uncertain: true } : {}), ...(saved || uncertain ? { recoveryRequired: true } : {}) };
  } finally { if (timer) clearTimeout(timer); budget.abort(); }
}
export async function readProjectDownload(url: string, file: ProjectDownloadDescription, context: { signal: AbortSignal; assert(): void }): Promise<Buffer> {
  const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), PROJECT_DOWNLOAD_TIMEOUT_MS);
  const invalid = () => new ProjectHubError('INVALID_DOWNLOAD_BYTES', 'La respuesta no coincide con el archivo revisado.');
  try {
    context.assert();
    const response = await fetch(url, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { 'accept-encoding': 'identity' }, signal: AbortSignal.any([context.signal, timeout.signal]) });
    context.assert();
    if (response.status !== 200 || !response.body) throw invalid();
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > PROJECT_UPLOAD_MAX_BYTES)) throw invalid();
    const reader = response.body.getReader(); const chunks: Buffer[] = []; const hash = createHash('sha256'); let size = 0;
    const validator = new ProjectFileContentValidator(file.mime);
    try {
      while (true) {
        const chunk = await reader.read(); context.assert(); if (chunk.done) break;
        size += chunk.value.byteLength; if (size > file.size || size > PROJECT_UPLOAD_MAX_BYTES) throw invalid();
        const bytes = Buffer.from(chunk.value); hash.update(bytes); validator.update(bytes); chunks.push(bytes);
      }
      validator.finish(); context.assert();
      if (size !== file.size || hash.digest('hex') !== file.sha256) throw invalid();
      return Buffer.concat(chunks, size);
    } finally { reader.releaseLock(); }
  } catch (error) {
    context.assert();
    if (error instanceof ProjectHubError) throw error;
    throw new ProjectHubError(timeout.signal.aborted ? 'TIMEOUT' : 'DOWNLOAD_FAILED', 'No se pudo comprobar la descarga.');
  } finally { clearTimeout(timer); timeout.abort(); }
}
