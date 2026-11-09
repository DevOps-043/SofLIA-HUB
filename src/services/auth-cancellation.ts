export function throwIfAuthCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Operación de autenticación cancelada', 'AbortError');
}

export function waitForAuthRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAuthCancelled(signal);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    const cancel = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new DOMException('Operación de autenticación cancelada', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
