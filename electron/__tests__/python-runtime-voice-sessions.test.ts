import { describe, expect, it, vi } from 'vitest';
import { PythonRuntimeService } from '../python-runtime-service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function createReadyService() {
  const service = new PythonRuntimeService();
  const internals = service as unknown as {
    resolveModelPath: () => string | null;
    ensureSidecar: () => Promise<void>;
  };
  vi.spyOn(internals, 'resolveModelPath').mockReturnValue('C:\\model');
  vi.spyOn(internals, 'ensureSidecar').mockResolvedValue(undefined);
  const sendCommand = vi.spyOn(service, 'sendCommand').mockResolvedValue({ ok: true });
  return { service, sendCommand };
}

function deliver(service: PythonRuntimeService, payload: Record<string, unknown>): void {
  (service as unknown as { handleMessage: (line: string) => void })
    .handleMessage(JSON.stringify(payload));
}

function isDictating(service: PythonRuntimeService): boolean {
  return (service as unknown as { dictating: boolean }).dictating;
}

describe('PythonRuntimeService voice session ownership', () => {
  it('VOICE-SESSION-1: concurrent starts share one sidecar listener and one session ID', async () => {
    const { service, sendCommand } = createReadyService();
    const commandResponse = deferred<Record<string, unknown>>();
    sendCommand.mockReturnValueOnce(commandResponse.promise);

    const firstStart = service.startDictation();
    const secondStart = service.startDictation();

    await Promise.resolve();
    expect(sendCommand).toHaveBeenCalledTimes(1);
    commandResponse.resolve({ ok: true });
    const [first, second] = await Promise.all([firstStart, secondStart]);

    expect(first.success).toBe(true);
    expect(second).toEqual(first);
    expect(first.sessionId).toMatch(/^dictation-/);
    // El tercer argumento es el timeout ampliado que tolera la carga del modelo grande.
    expect(sendCommand).toHaveBeenCalledWith(
      'start_dictation',
      expect.objectContaining({ session_id: first.sessionId }),
      expect.any(Number),
    );
  });

  it('VOICE-SESSION-2: late events from turn one cannot mutate or finish turn two', async () => {
    const { service } = createReadyService();
    const partials: unknown[] = [];
    const finals: unknown[] = [];
    const timeouts: unknown[] = [];
    service.on('dictation-partial', (payload) => partials.push(payload));
    service.on('dictation-final', (payload) => finals.push(payload));
    service.on('dictation-timeout', (payload) => timeouts.push(payload));

    const first = await service.startDictation();
    expect(first.sessionId).toBeTruthy();
    deliver(service, {
      event: 'dictation_final', session_id: first.sessionId, text: 'primera', reason: 'silence',
    });
    expect(finals).toHaveLength(1);

    const second = await service.startDictation();
    expect(second.sessionId).not.toBe(first.sessionId);
    deliver(service, {
      event: 'dictation_partial', session_id: first.sessionId, text: 'texto viejo',
    });
    deliver(service, {
      event: 'dictation_timeout', session_id: first.sessionId, reason: 'initial_silence',
    });
    deliver(service, {
      event: 'dictation_final', session_id: first.sessionId, text: 'duplicado', reason: 'silence',
    });

    expect(partials).toHaveLength(0);
    expect(timeouts).toHaveLength(0);
    expect(finals).toHaveLength(1);
    expect(isDictating(service)).toBe(true);

    deliver(service, {
      event: 'dictation_partial', session_id: second.sessionId, text: 'segunda valida',
    });
    deliver(service, {
      event: 'dictation_final', session_id: second.sessionId, text: 'segunda valida', reason: 'silence',
    });
    expect(partials).toEqual([{ sessionId: second.sessionId, text: 'segunda valida', reason: '' }]);
    expect(finals).toHaveLength(2);
    expect(isDictating(service)).toBe(false);
  });

  it('VOICE-SESSION-3: a stale stop cannot terminate the current session', async () => {
    const { service, sendCommand } = createReadyService();
    const started = await service.startDictation();
    (service as unknown as { proc: unknown }).proc = {};
    sendCommand.mockClear();

    await service.stopDictation('dictation-obsoleta');
    expect(sendCommand).not.toHaveBeenCalled();
    expect(isDictating(service)).toBe(true);

    await service.stopDictation(started.sessionId);
    expect(sendCommand).toHaveBeenCalledWith('stop_dictation', { session_id: started.sessionId });
    expect(isDictating(service)).toBe(false);
  });

  it('VOICE-SESSION-4: a failed handoff restores passive wake listening', async () => {
    const { service, sendCommand } = createReadyService();
    const startPassiveListening = vi
      .spyOn(service, 'startPassiveListening')
      .mockResolvedValue({ success: true });
    const internals = service as unknown as {
      config: { enabled: boolean };
      listening: boolean;
      wakeSuspended: boolean;
    };
    internals.config.enabled = true;
    internals.listening = true;
    sendCommand.mockResolvedValueOnce({ ok: false, error: 'microfono ocupado' });

    const result = await service.startDictation();

    expect(result).toEqual({ success: false, error: 'microfono ocupado' });
    expect(startPassiveListening).toHaveBeenCalledTimes(1);
    expect(internals.wakeSuspended).toBe(false);
    expect(isDictating(service)).toBe(false);
  });

  it('VOICE-SESSION-5: stale conversation cleanup cannot resume wake over a new dictation', async () => {
    const { service, sendCommand } = createReadyService();
    const current = await service.startDictation();
    const startPassiveListening = vi.spyOn(service, 'startPassiveListening');
    sendCommand.mockClear();

    await service.resumeWakeAfterConversation('dictation-obsoleta');

    expect(sendCommand).not.toHaveBeenCalled();
    expect(startPassiveListening).not.toHaveBeenCalled();
    expect(isDictating(service)).toBe(true);
    await service.stopDictation(current.sessionId);
  });

  it('VOICE-SESSION-6: Piper events and stop commands keep speech ownership', async () => {
    const service = new PythonRuntimeService();
    const internals = service as unknown as {
      resolvePiperPaths: () => { piperExe: string; voicePath: string } | null;
      ensureSidecar: () => Promise<void>;
      proc: unknown;
    };
    vi.spyOn(internals, 'resolvePiperPaths').mockReturnValue({
      piperExe: 'C:\\piper.exe',
      voicePath: 'C:\\voice.onnx',
    });
    vi.spyOn(internals, 'ensureSidecar').mockResolvedValue(undefined);
    const sendCommand = vi.spyOn(service, 'sendCommand').mockResolvedValue({ ok: true });

    const started = await service.speak('Hola');
    expect(started.success).toBe(true);
    expect(started.speechId).toMatch(/^speech-/);
    expect(sendCommand).toHaveBeenCalledWith('tts_speak', expect.objectContaining({
      utterance_id: started.speechId,
    }));

    internals.proc = {};
    sendCommand.mockClear();
    await service.stopSpeaking('speech-obsoleto');
    expect(sendCommand).not.toHaveBeenCalled();

    await service.stopSpeaking(started.speechId);
    expect(sendCommand).toHaveBeenCalledWith('tts_stop', { utterance_id: started.speechId });
  });
});
