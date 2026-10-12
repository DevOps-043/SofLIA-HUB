import { parseLearningLiveSession, type LearningLiveOpenResult } from '../src/shared/learning-live-session';
import { learningLiveEndpoint, readLearningResponse } from './learning-live-http';

interface Dependencies {
  baseUrl: string;
  getIdentity: () => Promise<{ userId: string; accessToken: string } | null>;
  openTab: (url: string) => Promise<unknown>;
  fetcher?: typeof fetch;
}

export function isZoomSessionUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      ['zoom.us', 'zoom.com'].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

/** Lógica sin Electron: la identidad y la apertura son dependencias verificables. */
export async function openLearningLiveSession(input: unknown, deps: Dependencies): Promise<LearningLiveOpenResult> {
  const reference = parseLearningLiveSession(input);
  const endpoint = learningLiveEndpoint(deps.baseUrl, 'access');
  if (!reference || !endpoint) return { success: false, code: 'unavailable', error: 'La sesión o el origen de Learning no están configurados correctamente.' };
  try {
    const identity = await deps.getIdentity();
    if (!identity) return { success: false, code: 'not_ready', error: 'Inicia sesión con tu cuenta de Soflia Learning para abrir la clase.' };
    const response = await (deps.fetcher || fetch)(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.accessToken}` },
      body: JSON.stringify(reference), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return {
      success: false, code: response.status >= 500 ? 'unavailable' : 'access_denied',
      error: response.status >= 500 ? 'Learning no está disponible. Reintenta desde tu agenda.' : response.status === 409 ? 'La sesión ya terminó o no tiene acceso disponible.' : 'Learning no autorizó el acceso. Verifica tu cuenta y el curso asignado.',
    };
    const body = await readLearningResponse(response, 65536) as { session?: { id?: unknown; title?: unknown }; join_url?: unknown };
    if (body.session?.id !== reference.session_id || typeof body.session.title !== 'string' ||
        body.session.title.length > 160 || !isZoomSessionUrl(body.join_url)) throw new Error('Acceso no válido');
    // Un cierre/cambio de cuenta durante la petición no debe abrir medios ajenos.
    if ((await deps.getIdentity())?.userId !== identity.userId)
      return { success: false, code: 'not_ready', error: 'La cuenta cambió durante el acceso. Vuelve a abrir la sesión desde Learning.' };
    await deps.openTab(body.join_url);
    return { success: true, title: body.session.title };
  } catch {
    return { success: false, code: 'unavailable', error: 'No se pudo abrir la sesión. Reintenta desde Learning.' };
  }
}
