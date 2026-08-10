import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrbTtsPlayback } from '../../services/orb/tts-playback';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function installAudioContext(decode: () => Promise<AudioBuffer>) {
  const source = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
    createBufferSource: vi.fn(() => source),
    decodeAudioData: vi.fn(decode),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  class FakeAudioContext {
    constructor() {
      return context as unknown as FakeAudioContext;
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { context, source };
}

describe('reproducción ElevenLabs de la Orbe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ORB-VOICE-10: decodifica MP3, lo encola y notifica al terminar', async () => {
    const audioBuffer = { length: 100, duration: 1.25 } as AudioBuffer;
    const { context, source } = installAudioContext(async () => audioBuffer);
    const drained = vi.fn();
    const playback = new OrbTtsPlayback();
    playback.setOnDrained(drained);

    await playback.enqueueEncoded('AQIDBA==');
    playback.markTtsFinished();

    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(source.buffer).toBe(audioBuffer);
    expect(source.start).toHaveBeenCalledWith(1.02);
    expect(drained).not.toHaveBeenCalled();
    source.onended?.();
    expect(drained).toHaveBeenCalledTimes(1);
  });

  it('ORB-VOICE-11: descarta una decodificación que termina después de cancelar', async () => {
    const pending = deferred<AudioBuffer>();
    const { context } = installAudioContext(() => pending.promise);
    const playback = new OrbTtsPlayback();

    const enqueue = playback.enqueueEncoded('AQIDBA==');
    playback.stop();
    pending.resolve({ length: 100, duration: 1 } as AudioBuffer);
    await enqueue;

    expect(context.createBufferSource).not.toHaveBeenCalled();
  });
});
