import { useEffect, useRef, useState } from 'react';
import type { AuthState, ShareLinkNotice } from './app-types';
import { learningLiveService } from '../services/learning-live-service';
import type { LearningLiveSessionReference } from '../shared/learning-live-session';

/** La petición sobrevive al login; se descartan efectos de una cuenta anterior. */
export function useLearningLiveSession(input: {
  auth: AuthState;
  enabled: boolean;
  onNotice: (notice: ShareLinkNotice) => void;
  onRequested?: () => void;
}) {
  const { auth, enabled, onNotice, onRequested } = input;
  const { loading, user, learningSsoAvailable, ssoPending, signInWithLearningSso } = auth;
  const userId = user?.id;
  const [pending, setPending] = useState<LearningLiveSessionReference | null>(null);
  const attemptedLogin = useRef<string | null>(null);
  const callbacks = useRef({ onNotice, onRequested });
  useEffect(() => { callbacks.current = { onNotice, onRequested }; }, [onNotice, onRequested]);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let received = false;
    const off = learningLiveService.subscribe((reference) => {
      received = true;
      attemptedLogin.current = null;
      setPending(reference);
      callbacks.current.onRequested?.();
    });
    void learningLiveService.getPending().then((reference) => {
      if (!disposed && !received && reference) { setPending(reference); callbacks.current.onRequested?.(); }
    }).catch(() => { if (!disposed) callbacks.current.onNotice({ tone: 'error', message: 'No se pudo recuperar la sesión solicitada desde Learning.' }); });
    return () => { disposed = true; off(); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pending || loading || user || !learningSsoAvailable || ssoPending) return;
    const key = `${pending.organization_slug}:${pending.session_id}`;
    if (attemptedLogin.current === key) return;
    attemptedLogin.current = key;
    void signInWithLearningSso().catch(() => callbacks.current.onNotice({ tone: 'error', message: 'Inicia sesión para continuar a la clase de Learning.' }));
  }, [enabled, pending, loading, user, learningSsoAvailable, ssoPending, signInWithLearningSso]);

  // El aula confirma permisos al montar; recibir la referencia no abre medios.
  return { reference: enabled && !loading && userId ? pending : null, select: (reference: LearningLiveSessionReference) => { setPending(reference); callbacks.current.onRequested?.(); }, dismiss: () => setPending(null) };
}
