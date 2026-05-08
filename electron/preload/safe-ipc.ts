import { ALLOWED_IPC_CHANNELS } from './channels';
import type {
  IpcRendererLike,
  SafeIpc,
} from './types';

function sanitizePayload(payload: any): any {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'function') {
    throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.');
  }
  if (Array.isArray(payload)) return payload.map(sanitizePayload);
  if (typeof payload !== 'object') return payload;

  const safeObj: Record<string, any> = { ...payload };
  for (const key in safeObj) {
    if (Object.prototype.hasOwnProperty.call(safeObj, key)) {
      safeObj[key] = sanitizePayload(safeObj[key]);
    }
  }
  return safeObj;
}

function validateChannel(channel: string): void {
  if (ALLOWED_IPC_CHANNELS.includes(channel as never)) return;
  console.error(`ALERTA DE SEGURIDAD: Intento de uso de canal IPC no autorizado: ${channel}`);
  throw new Error(`Unauthorized IPC channel: ${channel}`);
}

export function createSafeIpc(ipcRenderer: IpcRendererLike): SafeIpc {
  return {
    sanitizePayload,
    validateChannel,
    safeInvoke: (channel, ...args) => {
      validateChannel(channel);
      return ipcRenderer.invoke(channel, ...args.map(sanitizePayload));
    },
    safeSend: (channel, ...args) => {
      validateChannel(channel);
      return ipcRenderer.send(channel, ...args.map(sanitizePayload));
    },
    safeOn: (channel, cb) => {
      validateChannel(channel);
      ipcRenderer.on(channel, (_event, ...args) => cb(...args.map(sanitizePayload)));
    },
    safeRemoveAllListeners: (channel) => {
      validateChannel(channel);
      ipcRenderer.removeAllListeners(channel);
    },
  };
}
