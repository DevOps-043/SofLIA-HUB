import type { LiveCallbacks } from './types';
import { LiveAudioPlayback } from './audio-playback';

export interface LiveRuntime {
  ws: WebSocket | null;
  callbacks: LiveCallbacks;
  isConnected: boolean;
  isConnecting: boolean;
  setupComplete: boolean;
  sessionStartTime: number;
  maxSessionDuration: number;
  sessionCheckInterval: ReturnType<typeof setInterval> | null;
  retriedWithoutTools: boolean;
  isDisposed: boolean;
  audio: LiveAudioPlayback;
}

export function createLiveRuntime(callbacks: LiveCallbacks): LiveRuntime {
  return {
    ws: null,
    callbacks,
    isConnected: false,
    isConnecting: false,
    setupComplete: false,
    sessionStartTime: 0,
    maxSessionDuration: 14 * 60 * 1000,
    sessionCheckInterval: null,
    retriedWithoutTools: false,
    isDisposed: false,
    audio: new LiveAudioPlayback(),
  };
}

export function sendLivePayload(runtime: LiveRuntime, data: any): void {
  if (!runtime.isDisposed && runtime.ws?.readyState === WebSocket.OPEN) {
    runtime.ws.send(JSON.stringify(data));
  }
}
