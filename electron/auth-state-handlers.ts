import { ipcMain, type BrowserWindow } from 'electron';
import { getAuthState, setAuthState } from './main/auth-state';
import { applyHubSession, revokeHubSession } from './main/hub-session';
import { bindOpenAIHubSession } from './openai-runtime/session-binding';
import { applySofiaSession, getSofiaSessionUserId, isSofiaMainSessionConfigured, revokeSofiaSession } from './main/sofia-session';
import { getProjectHubApiService } from './project-hub';
import { setOrganizationContext } from './main/organization-context';
import { parseAuthStatePayload } from './ipc/auth-state-contract';
import { rendererSource } from './ipc/renderer-source';
import { createLogger } from './utils/logger';
import type { AuthStatePayload, AuthStateReply } from '../src/shared/auth-state';

const log = createLogger('auth-state');
const deniedState = (): AuthStatePayload => ({ authenticated: false, userId: null });

/** Sólo el Hub publica; Hub y Orbe leen. Los getters siguen el ciclo de bootstrap. */
export function registerAuthStateHandlers(getWindow: () => BrowserWindow | null, getOrb: () => BrowserWindow | null): void {
  let publication = 0;
  ipcMain.handle('auth:set-state', async (event, ...args: unknown[]): Promise<AuthStateReply> => {
    const source = rendererSource(event.sender, event.senderFrame, () => [getWindow()]);
    const snapshot = (): AuthStatePayload => {
      try { source.assert(); return getAuthState(); } catch { return deniedState(); }
    };
    try {
      // Antes de leer payload, estado privado o tocar cualquier servicio.
      source.assert();
      const parsed = args.length === 1 ? parseAuthStatePayload(args[0]) : null;
      if (!parsed) {
        log.warn('Payload de estado inválido; se conserva el estado actual.');
        return { ok: false, state: getAuthState(), reason: 'invalid_payload' };
      }
      const revision = ++publication;
      const current = () => { source.assert(); return revision === publication; };

      if (!parsed.authenticated) {
        // Cerrar el gate y la selección antes de esperar efectos de revocación.
        setAuthState(deniedState());
        setOrganizationContext(null, null);
        await Promise.all([revokeSofiaSession(), revokeHubSession(), getProjectHubApiService().logout()]);
        return { ok: current(), state: snapshot() };
      }

      let verifiedSofiaUserId = getSofiaSessionUserId();
      let verifiedSofiaAccessToken: string | undefined;
      let sofiaSessionRevoked = false;
      if (parsed.sofiaAccessToken && parsed.sofiaRefreshToken) {
        const result = await applySofiaSession(
          { accessToken: parsed.sofiaAccessToken, refreshToken: parsed.sofiaRefreshToken },
          parsed.userId!,
        );
        if (!current()) return { ok: false, state: snapshot() };
        verifiedSofiaUserId = result.status === 'aplicada' ? result.userId : null;
        if (result.status === 'aplicada' && result.userId === parsed.userId) verifiedSofiaAccessToken = result.accessToken;
        if (result.status !== 'aplicada') sofiaSessionRevoked = result.revoked === true;
      }

      if (!current()) return { ok: false, state: snapshot() };
      const authenticated = isSofiaMainSessionConfigured()
        ? Boolean(verifiedSofiaUserId && verifiedSofiaUserId === parsed.userId)
        : parsed.authenticated;
      const state = setAuthState({ authenticated, userId: authenticated ? parsed.userId : null });
      setOrganizationContext(state.userId, parsed.organizationId);
      if (!authenticated && parsed.sofiaAccessToken) {
        log.warn('La sesión SOFIA publicada no pudo verificarse.');
        return { ok: false, state, reason: sofiaSessionRevoked ? 'sofia_revoked' : 'sofia_unverified' };
      }

      if (parsed.accessToken && parsed.refreshToken) {
        // Compatibilidad: sin tokens Lia el coordinador conserva su política actual.
        const hubResult = await applyHubSession({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }, parsed.userId);
        if (!current()) return { ok: false, state: snapshot() };
        if (hubResult === 'aplicada') bindOpenAIHubSession(state.userId);
      }

      if (authenticated && verifiedSofiaAccessToken) {
        const exchange = await getProjectHubApiService().exchangeSofiaToken(verifiedSofiaAccessToken);
        if (!current()) return { ok: false, state: snapshot() };
        if (!exchange.success) {
          const code = exchange.code;
          log.warn({ code: code && /^[A-Z][A-Z0-9_]{0,47}$/.test(code) ? code : undefined },
            'Canje SOFIA de Project Hub rechazado.');
        }
      }
      return { ok: true, state: snapshot() };
    } catch {
      log.warn('Publicación de autenticación rechazada o interrumpida.');
      return { ok: false, state: snapshot() };
    } finally { source.dispose(); }
  });

  ipcMain.handle('auth:get-state', (event, ...args: unknown[]): AuthStatePayload => {
    const source = rendererSource(event.sender, event.senderFrame, () => [getWindow(), getOrb()]);
    try {
      source.assert();
      return args.length === 0 ? getAuthState() : deniedState();
    } catch { return deniedState(); }
    finally { source.dispose(); }
  });
}
