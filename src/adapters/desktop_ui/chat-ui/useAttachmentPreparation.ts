import { useLayoutEffect, useRef, useState } from 'react';

/** Exclusión inmediata: dos clics antes del siguiente render no envían dos turnos. */
export function useAttachmentPreparation(contextKey: string) {
  const pending = useRef<AbortController | null>(null);
  const [status, setStatus] = useState({ contextKey, busy: false, error: null as string | null });
  if (status.contextKey !== contextKey) setStatus({ contextKey, busy: false, error: null });
  useLayoutEffect(() => {
    return () => { pending.current?.abort(); pending.current = null; };
  }, [contextKey]);
  const cancel = () => {
    pending.current?.abort(); pending.current = null;
    setStatus({ contextKey, busy: false, error: null });
  };
  const run = async (prepare: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller; setStatus({ contextKey, busy: true, error: null });
    try { await prepare(controller.signal); }
    catch (failure) {
      if (pending.current === controller && !controller.signal.aborted) {
        setStatus({ contextKey, busy: false, error: failure instanceof Error ? failure.message : 'No se pudieron preparar los adjuntos.' });
      }
    } finally {
      if (pending.current === controller) { pending.current = null; setStatus((current) => ({ ...current, busy: false })); }
    }
  };
  return { busy: status.contextKey === contextKey && status.busy, error: status.contextKey === contextKey ? status.error : null, cancel, run };
}
