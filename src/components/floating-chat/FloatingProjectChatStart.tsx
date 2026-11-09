import { useRef, useState } from 'react';

/** No habilita envío hasta que el espacio del proyecto esté preparado. */
export function FloatingProjectChatStart({ canCreate, message, onStart }: { canCreate: boolean; message?: string; onStart(): Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const start = async () => {
    if (pending.current || !canCreate) return;
    pending.current = true; setBusy(true); setError('');
    try { await onStart(); }
    catch { setError('No se pudo preparar el chat. Pulsa + para reintentar.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="soflia-floating-project-start">
    {canCreate ? <button type="button" className="soflia-floating-start-input" disabled={busy} aria-label="Preparar chat del proyecto para escribir" onClick={() => void start()}>{busy ? 'Preparando chat…' : 'Escribe a Soflia…'}</button> : <p className="soflia-floating-notice">{message || 'Este proyecto no permite escribir con tu acceso actual.'}</p>}
    {error && <p role="alert" className="soflia-floating-notice">{error}</p>}
    {message && canCreate && <p role="status" className="soflia-floating-notice">{message}</p>}
  </div>;
}
