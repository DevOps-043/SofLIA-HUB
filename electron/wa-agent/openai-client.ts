import OpenAI from 'openai';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { getHubSessionUserId } from '../main/hub-session';
import { getHubDbClient } from '../hub-db-client';

let sessionVersion = 0;
onAuthStateChange(() => { sessionVersion++; });

/** Credencial del Hub autenticado; nunca reutiliza la clave Gemini ni la cachea entre usuarios. */
export async function getWhatsAppOpenAIClient(): Promise<OpenAI> {
  const actor = getAuthState(); const hubUser = getHubSessionUserId();
  const version = sessionVersion;
  if (!actor.authenticated || !actor.userId || !hubUser) throw new Error('Sesión del Hub no disponible para OpenAI.');
  let changed = false;
  const remove = onAuthStateChange(() => { changed = true; });
  try {
    const { data, error } = await getHubDbClient().rpc('get_api_key', { p_provider: 'openai' }).abortSignal(AbortSignal.timeout(15_000));
    if (changed || getHubSessionUserId() !== hubUser || getAuthState().userId !== actor.userId) throw new Error('La sesión cambió al resolver OpenAI.');
    if (error) throw new Error('No se pudo obtener la configuración OpenAI del Hub.');
    const apiKey = (typeof data === 'string' ? data : '') || process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey?.trim()) throw new Error('API key de OpenAI no configurada para WhatsApp.');
    const guard = () => {
      if (version !== sessionVersion || !getAuthState().authenticated || getAuthState().userId !== actor.userId || getHubSessionUserId() !== hubUser) {
        throw new Error('La sesión de OpenAI cambió; el turno fue detenido.');
      }
    };
    return new OpenAI({ apiKey, maxRetries: 0, timeout: 90_000, fetch: async (url, init) => {
      guard();
      const controller = new AbortController();
      const unbind = onAuthStateChange(() => controller.abort());
      const abort = () => controller.abort();
      init?.signal?.addEventListener('abort', abort, { once: true });
      if (init?.signal?.aborted) controller.abort();
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        // Responses no usa streaming aquí: mantener la guarda hasta recibir todo el JSON.
        const body = await response.arrayBuffer();
        guard();
        return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      } finally { unbind(); init?.signal?.removeEventListener('abort', abort); }
    } });
  } finally { remove(); }
}
