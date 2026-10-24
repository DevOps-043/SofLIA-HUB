import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createSidecarTranscriptionPort } from '../meeting-live/transcription-port';
import type { PythonRuntimeService } from '../python-runtime-service';
import { deferred } from './project-hub/fixtures';
function fixture() {
  const runtime = Object.assign(new EventEmitter(), { ensureSidecarRunning: vi.fn(async () => {}), sendCommand: vi.fn(async () => ({ ok: true })), sendNotification: vi.fn(() => true) });
  return { runtime, port: createSidecarTranscriptionPort(runtime as unknown as PythonRuntimeService) };
}
const input = { sessionId: 'reunion-ficticia', language: 'es', modelSize: 'small', downloadRoot: 'C:/modelos-ficticios', speakerModelPath: null };
describe('Continuidad de Meeting Live al revocar la voz local', () => {
  it('notifica la interrupción y no reenvía audio a un hijo nuevo', async () => {
    const { runtime, port } = fixture(); await port.start(input); const error = vi.fn(); const unsubscribe = port.onError(error);
    runtime.emit('sidecar-unavailable'); expect(error).toHaveBeenCalledWith(expect.objectContaining({ sessionId: input.sessionId }));
    expect(port.pushAudio('mic', 'ficticio')).toBe(false); expect(runtime.sendNotification).not.toHaveBeenCalled();
    await expect(port.stop(input.sessionId)).rejects.toThrow(/incompleto/); unsubscribe(); expect(runtime.eventNames()).toEqual([]);
  });
  it('conserva la interrupción entre start y registro del consumidor', async () => {
    const { runtime, port } = fixture(); await port.start(input); runtime.emit('sidecar-unavailable'); const error = vi.fn(); const unsubscribe = port.onError(error);
    await Promise.resolve(); expect(error).toHaveBeenCalledOnce(); unsubscribe(); await expect(port.stop(input.sessionId)).rejects.toThrow();
  });
  it('una revocación durante ready no envía meeting_start', async () => {
    const { runtime, port } = fixture(); const ready = deferred<void>(); runtime.ensureSidecarRunning.mockReturnValueOnce(ready.promise);
    const pending = expect(port.start(input)).rejects.toThrow(/detenido/); runtime.emit('sidecar-unavailable'); ready.resolve(); await pending;
    expect(runtime.sendCommand).not.toHaveBeenCalled(); expect(runtime.eventNames()).toEqual([]);
  });
  it('retirar el consumidor cancela un aviso ya encolado', async () => {
    const { runtime, port } = fixture(); await port.start(input); runtime.emit('sidecar-unavailable'); const error = vi.fn(); const unsubscribe = port.onError(error);
    unsubscribe(); await Promise.resolve(); expect(error).not.toHaveBeenCalled(); await expect(port.stop(input.sessionId)).rejects.toThrow();
  });
});
