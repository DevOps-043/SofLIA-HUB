import { useEffect, useRef, useState } from 'react';

interface ChatUnavailableStateProps {
  onRetry?: () => Promise<boolean>;
}

const RECOVERY_DELAYS_MS = [500, 2_000];

export function ChatUnavailableState({ onRetry }: ChatUnavailableStateProps) {
  const [recovering, setRecovering] = useState(Boolean(onRetry));
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retry = useRef(onRetry);
  const mounted = useRef(false);
  useEffect(() => { retry.current = onRetry; }, [onRetry]);
  const canRetry = Boolean(onRetry);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (attempt: number) => {
      timer = setTimeout(() => {
        void (async () => {
          let recovered = false;
          try { recovered = Boolean(await retry.current?.()); } catch { /* El fallo se muestra tras agotar los intentos. */ }
          if (cancelled || recovered) return;
          if (attempt + 1 < RECOVERY_DELAYS_MS.length) schedule(attempt + 1);
          else { setRecovering(false); setRetryFailed(true); }
        })();
      }, RECOVERY_DELAYS_MS[attempt]);
    };
    if (canRetry) schedule(0);
    return () => { mounted.current = false; cancelled = true; clearTimeout(timer); };
  }, [canRetry]);

  const handleRetry = async () => {
    if (!onRetry || retrying || recovering) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      const recovered = await onRetry();
      if (mounted.current) setRetryFailed(!recovered);
    } catch {
      if (mounted.current) setRetryFailed(true);
    } finally {
      if (mounted.current) setRetrying(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl rounded-3xl border border-border bg-card px-6 py-8 text-center">
        {recovering ? <p role="status" className="text-sm text-secondary">Cargando conversaciones…</p> : <>
          <h2 className="text-xl font-semibold text-primary">No pudimos cargar tus conversaciones</h2>
          <p className="mt-3 text-sm leading-6 text-secondary">
            Tu sesión sigue activa. Comprueba tu conexión e intenta nuevamente.
          </p>
          {retryFailed && <p role="alert" className="mt-4 text-sm text-warning">
            Aún no fue posible cargarlas. Espera un momento y vuelve a intentar.
          </p>}
          {onRetry && <button type="button" disabled={retrying}
            className="mt-6 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition disabled:cursor-wait disabled:opacity-60"
            onClick={() => void handleRetry()}>
            {retrying ? 'Cargando…' : 'Reintentar'}
          </button>}
        </>}
      </div>
    </div>
  );
}
