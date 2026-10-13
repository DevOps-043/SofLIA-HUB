import type { LearningLiveSessionReference } from '../shared/learning-live-session';
import { studioResponseSchema, type StudioCommand, type StudioResult, type studioOperationSchema } from '../shared/live-studio.contract';
import type { z } from 'zod';

export async function studioOperation(reference: LearningLiveSessionReference, operation: z.infer<typeof studioOperationSchema>): Promise<StudioResult> {
  if (!window.learningLive?.studio) return { success: false, code: 'unavailable', error: 'Actualiza Hub y publica la API del estudio en Learning.' };
  try {
    const result = await window.learningLive.studio(reference, operation);
    if (!result.success) return result;
    const response = { ...(result.snapshot ? { snapshot: result.snapshot } : {}), ...(result.zoom ? { zoom: result.zoom } : {}), ...(result.upload ? { upload: result.upload } : {}) };
    const parsed = studioResponseSchema.safeParse(response);
    if (!parsed.success || parsed.data.snapshot && parsed.data.snapshot.session_id !== reference.session_id) return { success: false, code: 'unavailable', error: 'Learning devolvió un estudio incompatible.' };
    return { success: true, ...parsed.data };
  } catch { return { success: false, code: 'unavailable', error: 'No se pudo conectar con Learning.' }; }
}
export async function studioCommand(reference: LearningLiveSessionReference, revision: number, command: StudioCommand, id = crypto.randomUUID()) {
  const operation = { type: 'command' as const, id, revision, command };
  const result = await studioOperation(reference, operation);
  // Una respuesta perdida se reintenta con el mismo UUID; Learning deduplica.
  return !result.success && result.code === 'unavailable' ? studioOperation(reference, operation) : result;
}
export function onStudioInvalidation(sessionId: string, listener: (status: 'connected' | 'disconnected' | 'changed') => void): () => void {
  return window.learningLive?.onStudioEvent?.((notice) => {
    if (!notice || typeof notice !== 'object' || !('session_id' in notice) || notice.session_id !== sessionId || !('status' in notice)) return;
    if (notice.status === 'connected' || notice.status === 'disconnected' || notice.status === 'changed') listener(notice.status);
  }) ?? (() => {});
}
export const studioFileMime = (file: File) => file.type || (file.name.endsWith('.md') ? 'text/markdown' : file.name.endsWith('.json') ? 'application/json' : 'text/plain');
export async function uploadStudioFile(reference: LearningLiveSessionReference, file: File): Promise<string> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('El archivo debe pesar entre 1 byte y 25 MB.');
  const mime = studioFileMime(file);
  const prepared = await studioOperation(reference, { type: 'upload', name: file.name, mime, bytes: file.size });
  if (!prepared.success) throw new Error(prepared.error);
  if (!prepared.upload) throw new Error('Learning no preparó la subida.');
  const response = await fetch(prepared.upload.url, { method: 'PUT', redirect: 'error', credentials: 'omit', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: file, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('No se pudo subir el archivo. Reintenta la selección.');
  return prepared.upload.path;
}
