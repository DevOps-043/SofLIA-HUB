import { z } from 'zod';
import { PROJECT_UPLOAD_TIMEOUT_MS } from '../../src/shared/project-hub-files';
import { ProjectHubError, projectHubToken } from './session-contract';
export { projectStorageOrigin } from './storage-target';

const intentSchema = z.object({ evidence_id: z.string().uuid(), path: z.string().max(1024), signed_url: z.string().max(100_000), token: projectHubToken }).strict();
export function projectUploadTarget(payload: unknown, origin: string, workspaceId: string, projectId: string, extension: string) {
  const parsed = z.array(intentSchema).length(1).safeParse(payload);
  if (!parsed.success || !origin) throw new ProjectHubError('INVALID_UPLOAD_TARGET', 'No se pudo comprobar el destino del archivo.');
  const intent = parsed.data[0];
  try {
    const expected = `${workspaceId}/${projectId}/${intent.evidence_id}.${extension}`;
    const url = new URL(intent.signed_url);
    if (intent.path !== expected || url.origin !== origin || url.username || url.password || url.hash
      || url.pathname !== `/storage/v1/object/upload/sign/project-files/${expected}`
      || [...url.searchParams.entries()].length !== 1 || url.searchParams.get('token') !== intent.token
      || intent.signed_url.includes('\\') || intent.signed_url.includes('%2f') || intent.signed_url.includes('%2F')) throw new Error('Destino incoherente.');
    return { evidenceId: intent.evidence_id, url: url.href };
  } catch { throw new ProjectHubError('INVALID_UPLOAD_TARGET', 'No se pudo comprobar el destino del archivo.'); }
}
/** La URL ya está vinculada a un origen/path/archivo; no usa cookies ni bearer de sesión. */
export async function putProjectUpload(url: string, bytes: Buffer, mime: string, context: { signal: AbortSignal; assert(): void }): Promise<void> {
  context.assert(); const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PROJECT_UPLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'PUT', body: new Uint8Array(bytes), redirect: 'error', credentials: 'omit',
      headers: { 'content-type': mime, 'cache-control': 'max-age=3600', 'x-upsert': 'false' },
      signal: AbortSignal.any([context.signal, timeout.signal]) });
    context.assert();
    void response.body?.cancel().catch(() => {});
    if (!response.ok) throw new ProjectHubError('UPLOAD_REJECTED', 'No se confirmó la recepción del archivo.');
  } catch (error) {
    context.assert();
    if (error instanceof ProjectHubError) throw error;
    throw new ProjectHubError(timeout.signal.aborted ? 'TIMEOUT' : 'UPLOAD_UNAVAILABLE', 'No se confirmó la recepción del archivo.');
  } finally { clearTimeout(timer); timeout.abort(); }
}
