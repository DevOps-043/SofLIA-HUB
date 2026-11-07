import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isOrbWindowRenderer, publishAuthState } from '../../services/auth-state';
import type { AuthOperations } from './auth-operations';

const PUBLICATION_RETRY_MS = [400, 1_200];

type AuthPublicationDeps = {
  operations: AuthOperations;
  ownerSignal: AbortSignal;
  usingSofia: boolean;
  revocation: number;
  loading: boolean;
  userId: string | null;
  organizationId: string | null;
  session: Session | null;
  sofiaSession: Session | null;
};

export function useAuthPublication({ operations, ownerSignal, usingSofia, revocation, loading,
  userId, organizationId, session, sofiaSession }: AuthPublicationDeps) {
  const accessToken = session?.access_token ?? null;
  const refreshToken = session?.refresh_token ?? null;
  const sofiaAccessToken = sofiaSession?.access_token ?? null;
  const sofiaRefreshToken = sofiaSession?.refresh_token ?? null;
  const sofiaUserId = sofiaSession?.user.id ?? null;
  const waitingForIdentity = loading && !userId;
  useEffect(() => {
    if (isOrbWindowRenderer()) return;
    // Una intención revocada no espera tokens; el arranque conserva su espera.
    if (!userId && revocation > 0) {
      void publishAuthState({ authenticated: false, userId: null });
      return;
    }
    if (waitingForIdentity) return;
    if (!operations.isCurrent(ownerSignal)) return;
    if (usingSofia && userId && (userId !== sofiaUserId || !sofiaAccessToken || !sofiaRefreshToken ||
      !operations.matchesSubject(ownerSignal, sofiaUserId))) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    let retryIndex = 0;
    const current = () => !cancelled && operations.isCurrent(ownerSignal);
    const publish = async () => {
      if (!current()) return;
      try {
        const accepted = await publishAuthState({ authenticated: Boolean(userId), userId, organizationId,
          accessToken, refreshToken, sofiaAccessToken, sofiaRefreshToken });
        if (accepted === 'revoked' && userId && current()) {
          operations.cancel(ownerSignal);
          return;
        }
        if (accepted === false && userId && current() && retryIndex < PUBLICATION_RETRY_MS.length) {
          retryTimer = window.setTimeout(() => { void publish(); }, PUBLICATION_RETRY_MS[retryIndex++]);
        }
      } catch {
        if (current()) console.warn('[autenticacion] no se pudo preparar la publicacion de sesion');
      }
    };
    void publish();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [operations, ownerSignal, usingSofia, revocation, waitingForIdentity, userId, organizationId, accessToken, refreshToken,
    sofiaUserId, sofiaAccessToken, sofiaRefreshToken]);
}
