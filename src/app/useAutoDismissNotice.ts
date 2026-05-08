import { useEffect } from 'react';

export function useAutoDismissNotice(
  notice: unknown,
  onDismiss: () => void,
  timeoutMs: number = 5000,
) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss, timeoutMs]);
}
