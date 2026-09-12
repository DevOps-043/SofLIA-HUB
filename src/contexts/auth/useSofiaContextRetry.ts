import { useCallback, useEffect } from 'react';
import type { SofiaContext } from '../../services/sofia-auth';
import type { SofiaContextIssue, SofiaContextResolution } from './types';

// El ultimo retraso se repite indefinidamente: la app no deja de intentarlo,
// pero tampoco martillea a SOFIA cuando la caida es larga.
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

type SofiaContextRetryDeps = {
  issue: SofiaContextIssue | null;
  usingSofia: boolean;
  userId: string | null;
  resolveSofiaContext: (sofiaUserId: string) => Promise<SofiaContextResolution>;
  setSofiaContext: (value: SofiaContext | null) => void;
  setSofiaContextIssue: (value: SofiaContextIssue | null) => void;
};

/**
 * Reintento del directorio de SOFIA (organizaciones y equipos) mientras esta
 * degradado.
 *
 * El aviso que ve el usuario promete que se reintentara automaticamente; sin
 * este bucle la unica salida era reiniciar la app, porque `useAuthLifecycle`
 * solo resuelve el contexto al restaurar la sesion o al cambiar de estado de
 * autenticacion. Una sesion sin token verificable no entra al bucle: ahi
 * reintentar no puede recuperar nada.
 */
export function useSofiaContextRetry(deps: SofiaContextRetryDeps): () => Promise<boolean> {
  const { issue, usingSofia, userId, resolveSofiaContext, setSofiaContext, setSofiaContextIssue } = deps;
  const autoRetryEnabled = issue?.retryable === true;

  const retrySofiaContext = useCallback(async (): Promise<boolean> => {
    if (!usingSofia || !userId) return false;
    const resolution = await resolveSofiaContext(userId);
    // `denied` lo resuelve el ciclo de vida de la sesion, no este reintento:
    // aqui solo se acepta un contexto valido.
    if (resolution.status !== 'ok') return false;
    setSofiaContext(resolution.context);
    setSofiaContextIssue(null);
    return true;
  }, [resolveSofiaContext, setSofiaContext, setSofiaContextIssue, usingSofia, userId]);

  useEffect(() => {
    if (!autoRetryEnabled || !usingSofia || !userId) return undefined;

    let cancelled = false;
    let running = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      timer = setTimeout(() => { void run(); }, delay);
    };

    const run = async () => {
      // `running` evita que una rafaga de `focus` lance consultas solapadas.
      if (cancelled || running) return;
      running = true;
      if (timer) clearTimeout(timer);
      try {
        const recovered = await retrySofiaContext();
        // Si se recupero, `issue` pasa a null y el efecto se desmonta solo.
        if (!cancelled && !recovered) schedule();
      } finally {
        running = false;
      }
    };

    schedule();

    // Recuperar la red o volver a la ventana suele coincidir con el momento en
    // que SOFIA vuelve: no hay que esperar al siguiente escalon del backoff.
    const runNow = () => { void run(); };
    window.addEventListener('online', runNow);
    window.addEventListener('focus', runNow);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', runNow);
      window.removeEventListener('focus', runNow);
    };
  }, [autoRetryEnabled, retrySofiaContext, usingSofia, userId]);

  return retrySofiaContext;
}
