import type { LiveRuntime } from './runtime';

export function startSessionCheck(runtime: LiveRuntime, reconnect: () => Promise<void>): void {
  if (runtime.sessionCheckInterval) clearInterval(runtime.sessionCheckInterval);
  runtime.sessionCheckInterval = setInterval(() => {
    if (runtime.isDisposed) return;
    const elapsed = Date.now() - runtime.sessionStartTime;
    if (elapsed >= runtime.maxSessionDuration) {
      console.log('Live API: Approaching 15-min session limit, auto-reconnecting...');
      void autoReconnect(runtime, reconnect);
    }
  }, 30000);
}

export function disconnectLiveSession(runtime: LiveRuntime, soft: boolean = false): void {
  console.log(`Live API: Disconnecting (soft: ${soft})...`);
  if (!soft) runtime.isDisposed = true;
  runtime.isConnected = false;
  runtime.isConnecting = false;
  runtime.setupComplete = false;
  runtime.retriedWithoutTools = false;

  if (runtime.sessionCheckInterval) {
    clearInterval(runtime.sessionCheckInterval);
    runtime.sessionCheckInterval = null;
  }
  runtime.audio.dispose();
  if (runtime.ws) {
    try {
      runtime.ws.close();
    } catch {
      // Ignore close errors.
    }
    runtime.ws = null;
  }
}

async function autoReconnect(runtime: LiveRuntime, reconnect: () => Promise<void>): Promise<void> {
  if (runtime.isDisposed) return;
  disconnectLiveSession(runtime, true);
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    runtime.isDisposed = false;
    await reconnect();
    console.log('Live API: Auto-reconnect successful');
  } catch (error) {
    console.error('Live API: Auto-reconnect failed', error);
    runtime.callbacks.onError(new Error('Reconexión automática fallida. Reintenta manualmente.'));
  }
}
