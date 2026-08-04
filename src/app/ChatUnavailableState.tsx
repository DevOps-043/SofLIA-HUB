import { useState } from 'react';

interface ChatUnavailableStateProps {
  onRetry?: () => Promise<boolean>;
}

export function ChatUnavailableState({ onRetry }: ChatUnavailableStateProps) {
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      setRetryFailed(!(await onRetry()));
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
        <h2 className="text-xl font-semibold text-white">No pudimos cargar tus conversaciones</h2>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Tu sesión sigue activa. Comprueba tu conexión e intenta nuevamente.
        </p>
        {retryFailed && (
          <p role="alert" className="mt-4 text-sm text-amber-200">
            Aún no fue posible cargarlas. Espera un momento y vuelve a intentar.
          </p>
        )}
        {onRetry && (
          <button
            type="button"
            disabled={retrying}
            className="mt-6 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-wait disabled:opacity-60"
            onClick={() => void handleRetry()}
          >
            {retrying ? 'Cargando…' : 'Reintentar'}
          </button>
        )}
      </div>
    </div>
  );
}
