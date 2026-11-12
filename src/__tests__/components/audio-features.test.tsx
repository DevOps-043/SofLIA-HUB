import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioFeatures } from '../../components/orb/useAudioFeatures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('analizador compartido para expresividad de voz', () => {
  it('reutiliza el nodo existente y publica registro sin otra captura ni contexto', () => {
    let update: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { update = callback; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const capture = vi.fn(); const createContext = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: capture } });
    vi.stubGlobal('AudioContext', createContext);
    const analyser = {
      fftSize: 2048, frequencyBinCount: 1024, disconnect: vi.fn(),
      getByteTimeDomainData: (bytes: Uint8Array) => { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(128 + Math.sin(i * Math.PI * 320 / 48000) * 38); },
      getByteFrequencyData: (bytes: Uint8Array) => { bytes.fill(0); bytes[7] = 230; bytes[8] = 200; },
      context: { sampleRate: 48000 },
    };
    const context = { state: 'running', sampleRate: 48000, createAnalyser: vi.fn(() => analyser), close: vi.fn() };
    const node = { connect: vi.fn(), disconnect: vi.fn() };
    const source = { kind: 'node' as const, context: context as unknown as AudioContext, node: node as unknown as AudioNode };
    const { result, unmount } = renderHook(() => useAudioFeatures(source));
    act(() => { update!(64); });
    expect(result.current.pitchConfidence!.current).toBeGreaterThan(.9);
    expect(result.current.level.current).toBeGreaterThan(0);
    expect(capture).not.toHaveBeenCalled(); expect(createContext).not.toHaveBeenCalled();
    unmount(); expect(node.disconnect).toHaveBeenCalledWith(analyser); expect(context.close).not.toHaveBeenCalled();
    expect(result.current.pitchConfidence!.current).toBe(0);
  });
  it('comunica permiso denegado sin dejar capturas ni bucles abiertos', async () => {
    const denied = new DOMException('Permiso denegado', 'NotAllowedError');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(denied) } });
    const frame = vi.fn(); vi.stubGlobal('requestAnimationFrame', frame);
    const onError = vi.fn(); vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source = { kind: 'mic' as const };
    const { result } = renderHook(() => useAudioFeatures(source, onError));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('permiso')));
    expect(result.current.level.current).toBe(0); expect(frame).not.toHaveBeenCalled();
  });
  it('analiza las pistas del dictado sin otra captura y sin detener las pistas prestadas', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const capture = vi.fn(), stop = vi.fn(), close = vi.fn(async () => {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: capture } });
    const analyser = { fftSize: 2048, frequencyBinCount: 1024, disconnect: vi.fn() };
    const node = { connect: vi.fn(), disconnect: vi.fn() };
    const context = { state: 'running', sampleRate: 48000, createMediaStreamSource: vi.fn(() => node), createAnalyser: vi.fn(() => analyser), close };
    vi.stubGlobal('AudioContext', function () { return context; });
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const source = { kind: 'stream' as const, stream };
    const { unmount } = renderHook(() => useAudioFeatures(source));
    expect(context.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(capture).not.toHaveBeenCalled(); unmount();
    expect(stop).not.toHaveBeenCalled(); expect(close).toHaveBeenCalled();
  });

});
