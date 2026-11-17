export const REFRESH_EVENT_COALESCE_MS = 50;

/** Un recurso, una solicitud en vuelo; las invalidaciones ocultas se recuperan al volver. */
export function createVisibleRefresh(task: () => Promise<void> | void, intervalMs: number, onError: (error: unknown) => void) {
  let disposed = false;
  let running = false;
  let dirty = false;
  let poll: ReturnType<typeof setTimeout> | undefined;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const visible = () => document.visibilityState !== 'hidden';
  const clear = () => {
    clearTimeout(poll); clearTimeout(scheduled);
    poll = undefined; scheduled = undefined;
  };
  const armPoll = () => {
    clearTimeout(poll);
    if (!disposed && visible() && intervalMs > 0) poll = setTimeout(request, intervalMs);
  };
  async function run() {
    scheduled = undefined;
    if (disposed || running || !visible()) return;
    running = true; dirty = false;
    clearTimeout(poll); poll = undefined;
    try { await task(); }
    catch (error) { if (!disposed) onError(error); }
    finally {
      running = false;
      if (!disposed && visible()) {
        if (dirty) request();
        else armPoll();
      }
    }
  }
  function request() {
    if (disposed) return;
    dirty = true;
    if (!visible() || running || scheduled !== undefined) return;
    clearTimeout(poll); poll = undefined;
    scheduled = setTimeout(() => { void run(); }, REFRESH_EVENT_COALESCE_MS);
  }
  const visibility = () => {
    if (visible()) request();
    else clear();
  };
  window.addEventListener('focus', request);
  document.addEventListener('visibilitychange', visibility);
  armPoll();
  return { request, dispose: () => {
    disposed = true; clear();
    window.removeEventListener('focus', request);
    document.removeEventListener('visibilitychange', visibility);
  } };
}
