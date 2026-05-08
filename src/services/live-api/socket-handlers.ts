import { buildSetupMessage } from './setup-message';
import { startSessionCheck } from './session-lifecycle';
import { processServerContent } from './server-content';
import { sendLivePayload, type LiveRuntime } from './runtime';

interface SocketHandlerInput {
  runtime: LiveRuntime;
  timeout: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (error: Error) => void;
  reconnect: () => Promise<void>;
}
export function wireLiveSocketHandlers(input: SocketHandlerInput): void {
  const { runtime } = input;
  if (!runtime.ws) return;
  runtime.ws.onopen = () => handleOpen(input);
  runtime.ws.onmessage = (event) => void handleMessage(input, event);
  runtime.ws.onerror = (event) => handleError(input, event);
  runtime.ws.onclose = (event) => void handleClose(input, event);
}

function handleOpen(input: SocketHandlerInput): void {
  const { runtime } = input;
  clearTimeout(input.timeout);
  runtime.isConnected = true;
  runtime.isConnecting = false;
  runtime.sessionStartTime = Date.now();
  startSessionCheck(runtime, input.reconnect);
  sendLivePayload(runtime, buildSetupMessage(!runtime.retriedWithoutTools));
}

async function handleMessage(input: SocketHandlerInput, event: MessageEvent): Promise<void> {
  const { runtime } = input;
  if (runtime.isDisposed) return;
  try {
    const data = await readLiveMessage(runtime, event);
    if (!data) return;
    if (data.setupComplete) {
      runtime.setupComplete = true;
      runtime.callbacks.onReady();
      input.resolve();
      return;
    }
    if (data.error) {
      console.error('Live API Error:', data.error);
      runtime.callbacks.onError(new Error(data.error.message || 'Error de servidor'));
      return;
    }
    if (data.serverContent) await processServerContent(runtime, data.serverContent);
  } catch (error) {
    console.error('Live API Message processing error', error);
  }
}

async function readLiveMessage(runtime: LiveRuntime, event: MessageEvent): Promise<any | null> {
  if (event.data instanceof Blob) {
    const text = await event.data.text();
    try {
      return JSON.parse(text);
    } catch {
      runtime.audio.playBinary(new Uint8Array(await event.data.arrayBuffer()), runtime.isDisposed);
      return null;
    }
  }
  return JSON.parse(event.data);
}

function handleError(input: SocketHandlerInput, event: Event): void {
  const { runtime } = input;
  clearTimeout(input.timeout);
  runtime.isConnected = false;
  runtime.isConnecting = false;
  const message = !navigator.onLine ? 'Sin conexión a internet' : 'Error de conexión WebSocket';
  console.error('Live API: WebSocket error', event);
  if (!runtime.isDisposed) runtime.callbacks.onError(new Error(message));
  input.reject(new Error(message));
}

async function handleClose(input: SocketHandlerInput, event: CloseEvent): Promise<void> {
  const { runtime } = input;
  const wasSetupComplete = runtime.setupComplete;
  runtime.isConnected = false;
  runtime.isConnecting = false;
  runtime.setupComplete = false;
  if (runtime.isDisposed) return;

  const reason = (event.reason || '').toLowerCase();
  if (!wasSetupComplete && !runtime.retriedWithoutTools && (reason.includes('invalid') || reason.includes('argument'))) {
    runtime.retriedWithoutTools = true;
    input.reconnect().then(input.resolve).catch(input.reject);
    return;
  }

  const closeReason = event.code === 1006
    ? 'Conexión cerrada inesperadamente.'
    : event.code === 1008 ? 'API key sin acceso a Live API.' : event.reason || '';
  if (closeReason && !wasSetupComplete) runtime.callbacks.onError(new Error(closeReason));
  runtime.callbacks.onClose();
}
