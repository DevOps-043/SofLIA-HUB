import { ECOSYSTEM_SESSION_PATH, ecosystemOrigin } from '../../src/shared/browser-ecosystem';

export interface EcosystemIdentity { userId: string; accessToken: string }
export class EcosystemSessionError extends Error {
  constructor(readonly code: 'endpoint-unavailable' | 'session-rejected', readonly status: number) {
    super(code === 'endpoint-unavailable'
      ? 'El sitio todavía no tiene activado el acceso con PulseHub. Hace falta publicar la integración en esa web.'
      : 'El sitio rechazó la conexión de la cuenta de PulseHub. Revisa la sesión y vuelve a intentarlo.');
  }
}
interface Dependencies {
  origins: readonly string[];
  getIdentity: () => Promise<EcosystemIdentity | null>;
  hasConnected: (origin: string) => boolean;
  remember: (origin: string) => void;
  fetcher: typeof fetch;
  assertCurrent: () => void;
  signal?: AbortSignal;
}

/** El canje usa la red de la partición; Chromium conserva las cookies del sitio. */
export async function connectEcosystemSession(target: string, deps: Dependencies, replace = false): Promise<boolean> {
  const origin = ecosystemOrigin(target, deps.origins);
  if (!origin) return false;
  deps.assertCurrent();
  if (!replace && deps.hasConnected(origin)) return false;
  const identity = await deps.getIdentity();
  deps.assertCurrent();
  if (!identity) return false;
  const response = await deps.fetcher(`${origin}${ECOSYSTEM_SESSION_PATH}`, {
    method: 'POST', credentials: 'include', redirect: 'error', cache: 'no-store',
    headers: { Authorization: `Bearer ${identity.accessToken}`, 'Content-Type': 'application/json', 'X-PulseHub-Session': '1', Origin: origin },
    body: JSON.stringify({ replace }),
    signal: deps.signal ? AbortSignal.any([deps.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  deps.assertCurrent();
  if ([404, 405].includes(response.status)) throw new EcosystemSessionError('endpoint-unavailable', response.status);
  const text = await response.text();
  if (text.length > 4096) throw new Error('Respuesta de sesión fuera de límites.');
  let data: { success?: unknown; userId?: unknown; preserved?: unknown; error?: unknown; code?: unknown } | null;
  try { data = JSON.parse(text); } catch {
    if (!response.ok) throw new EcosystemSessionError('session-rejected', response.status);
    throw new Error('El sitio no confirmó la identidad de PulseHub.');
  }
  if (!response.ok) {
    const middlewareBlocked = response.status === 401 && (data?.error === 'UNAUTHENTICATED' || data?.code === 'UNAUTHORIZED');
    throw new EcosystemSessionError(middlewareBlocked ? 'endpoint-unavailable' : 'session-rejected', response.status);
  }
  if (data?.success !== true || (data.preserved !== true && data.userId !== identity.userId))
    throw new Error('El sitio no confirmó la identidad de PulseHub.');
  deps.assertCurrent();
  if ((await deps.getIdentity())?.userId !== identity.userId) throw new Error('La cuenta cambió durante la conexión.');
  deps.assertCurrent();
  deps.remember(origin);
  return true;
}
