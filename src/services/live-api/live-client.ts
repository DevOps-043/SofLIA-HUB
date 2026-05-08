import { connectLiveSession } from './connect-session';
import { createLiveRuntime, sendLivePayload, type LiveRuntime } from './runtime';
import { disconnectLiveSession } from './session-lifecycle';
import type { LiveCallbacks } from './types';

export class LiveClient {
  private runtime: LiveRuntime;

  constructor(callbacks: LiveCallbacks) {
    this.runtime = createLiveRuntime(callbacks);
  }

  async connect(): Promise<void> {
    return connectLiveSession(this.runtime, () => this.connect());
  }

  send(data: any): void {
    sendLivePayload(this.runtime, data);
  }

  sendAudioChunk(base64Audio: string): void {
    if (this.runtime.isDisposed || !this.isReady()) return;
    this.send({
      realtimeInput: {
        audio: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' },
      },
    });
  }

  sendText(text: string): void {
    if (this.runtime.isDisposed || !this.isReady()) return;
    this.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    });
  }

  endAudioTurn(): void {
    if (this.runtime.isDisposed || !this.isReady()) return;
    this.send({ clientContent: { turnComplete: true } });
  }

  isReady(): boolean {
    return (
      !this.runtime.isDisposed &&
      this.runtime.isConnected &&
      this.runtime.ws?.readyState === WebSocket.OPEN &&
      this.runtime.setupComplete
    );
  }

  disconnect(soft: boolean = false): void {
    disconnectLiveSession(this.runtime, soft);
  }
}
