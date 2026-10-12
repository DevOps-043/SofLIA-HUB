import { useEffect, useRef, useState } from 'react';
import { copyTextWithFallback } from '../services/clipboard-service';

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error';

export function useCopyToClipboard() {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const pending = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const copy = async (text: string) => {
    if (pending.current) return;
    pending.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
    setStatus('copying');
    const success = await copyTextWithFallback(text);
    pending.current = false;
    if (!mounted.current) return;
    setStatus(success ? 'copied' : 'error');
    if (success) timer.current = setTimeout(() => setStatus('idle'), 2000);
  };

  return { status, copy };
}
