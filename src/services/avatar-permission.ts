const listeners = new Set<() => void>();
let pending = 0;
export const avatarPermission = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => pending > 0,
};

/** Observa únicamente la espera real; nunca decide ni recuerda autorizaciones. */
export async function withAvatarPermission<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return operation();
  pending++; listeners.forEach(listener => listener());
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true; pending--; listeners.forEach(listener => listener());
    signal?.removeEventListener('abort', finish);
  };
  signal?.addEventListener('abort', finish, { once: true });
  try { return await operation(); } finally { finish(); }
}
