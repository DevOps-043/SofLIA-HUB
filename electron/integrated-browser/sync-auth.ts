import { getHubDbClient } from '../hub-db-client';
import { getHubSessionUserId } from '../main/hub-session';
import { BrowserSyncRemote, BrowserSyncError, abortableSync, assertSyncActive, assertSyncUuid } from './sync-remote';
import type { BrowserSyncDeviceBinding } from './sync-device-identity';

export interface BrowserSyncConnection { binding: BrowserSyncDeviceBinding; remote: BrowserSyncRemote; dispose: () => void }
export type BrowserSyncConnectionFactory = (signal: AbortSignal, guard: () => void) => Promise<BrowserSyncConnection>;

export function readBrowserSyncClaims(token: string, origin: string): { ownerId: string; sessionId: string } {
  try {
    if (token.length > 16_384) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const value = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    assertSyncUuid(value.sub); assertSyncUuid(value.session_id);
    if (value.iss !== `${origin}/auth/v1` || value.role !== 'authenticated' || value.is_anonymous !== false
      || typeof value.exp !== 'number' || !Number.isSafeInteger(value.exp) || value.exp * 1000 <= Date.now()) throw new Error();
    // Esto sólo valida forma/vinculación. Auth y cada RPC verifican la firma.
    return { ownerId: value.sub, sessionId: value.session_id };
  } catch { throw new BrowserSyncError('Se necesita una sesión Lia no anónima vigente.'); }
}

export const createBrowserSyncConnection: BrowserSyncConnectionFactory = async (signal, guard) => {
  assertSyncActive(signal, guard);
  const client = getHubDbClient();
  const { data, error } = await abortableSync(client.auth.getSession(), signal);
  assertSyncActive(signal, guard);
  if (error || !data.session) throw new BrowserSyncError('Se necesita iniciar sesión en Lia.');
  const origin = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const claims = readBrowserSyncClaims(data.session.access_token, origin);
  if (claims.ownerId !== getHubSessionUserId()) throw new BrowserSyncError('La sesión Lia no corresponde al contexto de main.');
  let changed = false;
  const assertSession = () => {
    assertSyncActive(signal, guard);
    if (changed || getHubSessionUserId() !== claims.ownerId) throw new BrowserSyncError('La sesión de sincronización cambió.');
  };
  const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
    try {
      if (!session) { changed = true; return; }
      const next = readBrowserSyncClaims(session.access_token, origin);
      if (next.ownerId !== claims.ownerId || next.sessionId !== claims.sessionId) changed = true;
    } catch { changed = true; }
  });
  try {
    const remote = new BrowserSyncRemote({ origin, apiKey: process.env.VITE_SUPABASE_ANON_KEY || '', accessToken: data.session.access_token, ...claims }, assertSession);
    await remote.verify(signal);
    assertSession();
    return { binding: { origin, ...claims }, remote, dispose: () => listener.subscription.unsubscribe() };
  } catch (error) { listener.subscription.unsubscribe(); throw error; }
};
