import { ALLOWED_IPC_CHANNELS } from './channels';
import type {
  IpcRendererLike,
  SafeIpc,
} from './types';

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_IPC_DEPTH = 20;
const MAX_IPC_ARRAY_LENGTH = 1000;
const MAX_IPC_OBJECT_KEYS = 200;

function sanitizePayload(payload: any, depth = 0): any {
  if (depth > MAX_IPC_DEPTH) {
    throw new Error('Security Violation: IPC payload is too deeply nested.');
  }
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'function') {
    throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.');
  }
  if (Array.isArray(payload)) {
    if (payload.length > MAX_IPC_ARRAY_LENGTH) {
      throw new Error('Security Violation: IPC array payload is too large.');
    }
    return payload.map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof payload !== 'object') return payload;

  const entries = Object.entries(payload);
  if (entries.length > MAX_IPC_OBJECT_KEYS) {
    throw new Error('Security Violation: IPC object payload has too many keys.');
  }

  const safeObj: Record<string, any> = {};
  for (const [key, value] of entries) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) continue;
    safeObj[key] = sanitizePayload(value, depth + 1);
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
