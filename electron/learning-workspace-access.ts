import { workspaceRequestSchema, workspaceResponseSchema } from '../src/shared/learning-workspace.contract';
import type { LearningWorkspaceResult } from '../src/shared/learning-workspace';
import { learningLiveEndpoint, readLearningResponse } from './learning-live-http';

export interface LearningWorkspaceDependencies {
  baseUrl: string;
  getIdentity: () => Promise<{ userId: string; accessToken: string } | null>;
  fetcher?: typeof fetch;
}
export async function requestLearningWorkspace(input: unknown, deps: LearningWorkspaceDependencies): Promise<LearningWorkspaceResult> {
  const parsed = workspaceRequestSchema.safeParse(input);
  const endpoint = learningLiveEndpoint(deps.baseUrl, 'workspace');
  if (!parsed.success || !endpoint) return { success: false, code: 'access_denied', error: 'La solicitud o el origen Learning no son válidos.' };
  const body = JSON.stringify(parsed.data);
  if (Buffer.byteLength(body) > 32768) return { success: false, code: 'access_denied', error: 'El contenido supera el límite del aula.' };
  try {
    const identity = await deps.getIdentity();
    if (!identity) return { success: false, code: 'not_ready', error: 'Inicia sesión para acceder al aula.' };
    const response = await (deps.fetcher || fetch)(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.accessToken}` }, body,
    });
    if (!response.ok) return { success: false, code: response.status >= 500 || response.status === 429 ? 'unavailable' : 'access_denied', error: response.status === 409 ? 'El estado cambió. Actualiza el aula antes de continuar.' : response.status === 429 ? 'Espera un momento antes de continuar.' : response.status >= 500 ? 'Learning no está disponible. Puedes reintentar.' : 'Learning no autorizó la operación. Revisa tu cuenta y los permisos.' };
    const result = workspaceResponseSchema.parse(await readLearningResponse(response, 512 * 1024));
    if (result.snapshot && (result.snapshot.session.id !== parsed.data.session_id || result.snapshot.user_id !== identity.userId)) throw new Error('Respuesta para otro actor');
    if ((await deps.getIdentity())?.userId !== identity.userId) return { success: false, code: 'not_ready', error: 'La cuenta cambió durante la solicitud.' };
    return { success: true, ...result };
  } catch { return { success: false, code: 'unavailable', error: 'No se pudo completar la operación del aula.' }; }
}
