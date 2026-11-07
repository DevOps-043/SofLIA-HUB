import { AUTH_STATE_LIMITS, type AuthStatePublication } from '../../src/shared/auth-state';

const fields = new Set(['authenticated', 'userId', 'organizationId', 'accessToken', 'refreshToken', 'sofiaAccessToken', 'sofiaRefreshToken']);

function text(value: unknown, limit: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > limit) return undefined;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || (code >= 127 && code <= 159)) return undefined;
  }
  return value.trim() || null;
}

/** Sólo main valida datos no confiables. undefined representa un campo inválido. */
export function parseAuthStatePayload(payload: unknown): Required<AuthStatePublication> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (Object.keys(payload).some(key => !fields.has(key))) return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.authenticated !== 'boolean') return null;
  const userId = text(candidate.userId, AUTH_STATE_LIMITS.id);
  const organizationId = text(candidate.organizationId, AUTH_STATE_LIMITS.id);
  if (userId === undefined || (candidate.authenticated && !userId) || organizationId === undefined) return null;
  // La selección conserva el formato existente: no normalizar un ID inválido.
  if (candidate.organizationId != null && (typeof candidate.organizationId !== 'string' || !/^[\w-]{1,128}$/.test(candidate.organizationId))) return null;
  const accessToken = text(candidate.accessToken, AUTH_STATE_LIMITS.token);
  const refreshToken = text(candidate.refreshToken, AUTH_STATE_LIMITS.token);
  const sofiaAccessToken = text(candidate.sofiaAccessToken, AUTH_STATE_LIMITS.token);
  const sofiaRefreshToken = text(candidate.sofiaRefreshToken, AUTH_STATE_LIMITS.token);
  if (accessToken === undefined || refreshToken === undefined || sofiaAccessToken === undefined || sofiaRefreshToken === undefined) return null;
  if (Boolean(accessToken) !== Boolean(refreshToken) || Boolean(sofiaAccessToken) !== Boolean(sofiaRefreshToken)) return null;
  if (!candidate.authenticated) return { authenticated: false, userId: null, organizationId: null, accessToken: null, refreshToken: null, sofiaAccessToken: null, sofiaRefreshToken: null };
  return { authenticated: true, userId, organizationId, accessToken, refreshToken, sofiaAccessToken, sofiaRefreshToken };
}
