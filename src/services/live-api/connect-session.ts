import { GOOGLE_API_KEY, LIVE_API_URL, MODELS } from '../../config';
import { getApiKeyWithCache } from '../api-keys';
import { wireLiveSocketHandlers } from './socket-handlers';
import type { LiveRuntime } from './runtime';

export async function connectLiveSession(runtime: LiveRuntime, reconnect: () => Promise<void>): Promise<void> {
  if (runtime.isConnected || runtime.isConnecting) return;
  runtime.isConnecting = true;
  runtime.isDisposed = false;

  let apiKey = await getApiKeyWithCache('google');
  if (!apiKey) apiKey = GOOGLE_API_KEY;

  return new Promise((resolve, reject) => {
    try {
      if (!apiKey) {
        runtime.isConnecting = false;
        reject(new Error('API key de Google no configurada.'));
        return;
      }
      if (!LIVE_API_URL) {
        runtime.isConnecting = false;
        reject(new Error('URL de Live API no configurada.'));
        return;
      }

      console.log('Live API: Connecting to:', MODELS.LIVE);
      runtime.ws?.close();
      runtime.ws = new WebSocket(`${LIVE_API_URL}?key=${apiKey}`);
      const timeout = setTimeout(() => {
        if (!runtime.isConnected) {
          runtime.ws?.close();
          reject(new Error('Tiempo de conexión agotado'));
        }
      }, 15000);

      wireLiveSocketHandlers({ runtime, timeout, resolve, reject, reconnect });
      setTimeout(() => {
        if (runtime.isConnected && !runtime.setupComplete) {
          runtime.setupComplete = true;
          runtime.callbacks.onReady();
          runtime.isConnecting = false;
          resolve();
        }
      }, 3000);
    } catch (error) {
      runtime.isConnecting = false;
      reject(error);
    }
  });
}
