import { liveCatalogRequestSchema, liveCatalogResponseSchema, type LiveCatalogResult } from '../src/shared/learning-live-catalog';
import { learningLiveEndpoint, readLearningResponse } from './learning-live-http';
import type { LearningWorkspaceDependencies } from './learning-workspace-access';
import { createLogger } from './utils/logger';

const log = createLogger('learning-live-catalog');
const integrationUnavailable = 'La agenda de Learning todavía no está habilitada para Soflia Hub.';

async function catalogHttpFailure(response: Response): Promise<Extract<LiveCatalogResult, { success: false }>> {
  if (response.status === 401) {
    try {
      const body: unknown = await readLearningResponse(response, 4096);
      // El filtro web rechaza la consulta antes de verificar el bearer de Hub.
      if (typeof body === 'object' && body !== null && 'error' in body && body.error === 'UNAUTHENTICATED')
        return { success: false, code: 'unavailable', error: integrationUnavailable };
    } catch {
      // Un cuerpo ajeno o demasiado grande no cambia el diagnóstico HTTP.
    }
    return { success: false, code: 'not_ready', error: 'Learning no pudo validar tu sesión. Vuelve a iniciar sesión en Hub.' };
  }
  await response.body?.cancel().catch(() => undefined);
  if (response.status === 403) return { success: false, code: 'access_denied', error: 'No tienes acceso a las sesiones de esta organización.' };
  if (response.status === 404 || response.status === 405) return { success: false, code: 'unavailable', error: integrationUnavailable };
  if (response.status === 429) return { success: false, code: 'unavailable', error: 'Espera un momento antes de actualizar.' };
  return { success: false, code: 'unavailable', error: response.status >= 500 ? 'Learning no está disponible. Reintenta en un momento.' : 'Learning no pudo entregar tu agenda. Reintenta en un momento.' };
}

export async function requestLearningLiveCatalog(input: unknown, deps: LearningWorkspaceDependencies): Promise<LiveCatalogResult> {
  const parsed = liveCatalogRequestSchema.safeParse(input);
  const endpoint = learningLiveEndpoint(deps.baseUrl, 'catalog');
  if (!parsed.success) return { success: false, code: 'access_denied', error: 'La solicitud de sesiones no es válida.' };
  if (!endpoint) return { success: false, code: 'unavailable', error: 'El origen de Learning no está configurado correctamente.' };
  try {
    const identity = await deps.getIdentity();
    if (!identity) return { success: false, code: 'not_ready', error: 'Inicia sesión para consultar tus sesiones.' };
    const response = await (deps.fetcher || fetch)(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.accessToken}` }, body: JSON.stringify(parsed.data),
    });
    if (!response.ok) {
      const failure = await catalogHttpFailure(response);
      log.warn({ httpStatus: response.status, code: failure.code }, 'Learning rechazó la consulta de agenda');
      return failure;
    }
    const catalog = liveCatalogResponseSchema.parse(await readLearningResponse(response, 256 * 1024));
    if (catalog.user_id !== identity.userId || (await deps.getIdentity())?.userId !== identity.userId)
      return { success: false, code: 'not_ready', error: 'La cuenta cambió durante la consulta.' };
    return { success: true, catalog };
  } catch { return { success: false, code: 'unavailable', error: 'No se pudieron consultar tus sesiones. Puedes reintentar.' }; }
}
