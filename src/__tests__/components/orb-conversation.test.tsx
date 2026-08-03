import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface OrbCallbackRegistry {
  wake?: () => void;
  partial?: (payload: { sessionId: string; text: string }) => void;
  final?: (payload: { sessionId: string; text: string; reason: string }) => void;
  error?: (payload: { sessionId: string; reason: string }) => void;
  ttsChunk?: (payload: { speechId: string; audioBase64: string; sampleRate: number }) => void;
  ttsEnd?: (payload: { speechId: string; interrupted: boolean; error?: string }) => void;
}

const mocks = vi.hoisted(() => {
  const callbacks: OrbCallbackRegistry = {};
  return {
    callbacks,
    getPendingWake: vi.fn(async () => ({ success: true, wake: false })),
    startDictation: vi.fn(async () => ({ success: true, sessionId: 'dictation-default' })),
    stopDictation: vi.fn(async () => ({ success: true })),
    stopSpeaking: vi.fn(async () => ({ success: true })),
    speak: vi.fn(async () => ({ success: true, speechId: 'speech-default' })),
    conversationEnded: vi.fn(async () => ({ success: true })),
    hide: vi.fn(),
    sendMessageStream: vi.fn(),
    synthesizeCloudSpeech: vi.fn(),
  };
});

vi.mock('../../services/orb-service', () => ({
  orbService: {
    isAvailable: () => true,
    getPendingWake: mocks.getPendingWake,
    startDictation: mocks.startDictation,
    stopDictation: mocks.stopDictation,
    speak: mocks.speak,
    stopSpeaking: mocks.stopSpeaking,
    conversationEnded: mocks.conversationEnded,
    hide: mocks.hide,
    onWake: (callback: () => void) => { mocks.callbacks.wake = callback; },
    onDictationPartial: (callback: OrbCallbackRegistry['partial']) => { mocks.callbacks.partial = callback; },
    onDictationFinal: (callback: OrbCallbackRegistry['final']) => { mocks.callbacks.final = callback; },
    onDictationError: (callback: OrbCallbackRegistry['error']) => { mocks.callbacks.error = callback; },
    onTtsChunk: (callback: OrbCallbackRegistry['ttsChunk']) => { mocks.callbacks.ttsChunk = callback; },
    onTtsEnd: (callback: OrbCallbackRegistry['ttsEnd']) => { mocks.callbacks.ttsEnd = callback; },
    removeListeners: () => {
      delete mocks.callbacks.wake;
      delete mocks.callbacks.partial;
      delete mocks.callbacks.final;
      delete mocks.callbacks.error;
      delete mocks.callbacks.ttsChunk;
      delete mocks.callbacks.ttsEnd;
    },
  },
}));

vi.mock('../../services/gemini-chat', () => ({
  sendMessageStream: mocks.sendMessageStream,
}));

vi.mock('../../services/orb/google-cloud-tts', () => ({
  getStoredCloudVoice: () => 'test-voice',
  synthesizeCloudSpeech: mocks.synthesizeCloudSpeech,
}));

vi.mock('../../services/orb/tts-playback', () => ({
  OrbTtsPlayback: class {
    private onDrained: (() => void) | null = null;
    setOnDrained(callback: (() => void) | null) { this.onDrained = callback; }
    stop() { this.onDrained = null; }
    dispose() { this.onDrained = null; }
    enqueuePcm() {}
    enqueueChunk() {}
    markTtsFinished() {
      const callback = this.onDrained;
      this.onDrained = null;
      callback?.();
    }
  },
}));

import { useOrbConversation } from '../../components/orb/useOrbConversation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

describe('useOrbConversation session lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mocks.callbacks.wake;
    delete mocks.callbacks.partial;
    delete mocks.callbacks.final;
    delete mocks.callbacks.error;
    delete mocks.callbacks.ttsChunk;
    delete mocks.callbacks.ttsEnd;
    mocks.getPendingWake.mockResolvedValue({ success: true, wake: false });
    mocks.startDictation.mockResolvedValue({ success: true, sessionId: 'dictation-default' });
    mocks.speak.mockResolvedValue({ success: true, speechId: 'speech-default' });
    mocks.synthesizeCloudSpeech.mockReset();
    // Mantiene el agente pendiente para observar que ningun evento ajeno lo aborte.
    mocks.sendMessageStream.mockImplementation(() => new Promise(() => undefined));
  });

  it('ORB-VOICE-1: simultaneous listen triggers create only one dictation session', async () => {
    const startResult = deferred<{ success: boolean; sessionId: string }>();
    mocks.startDictation.mockReturnValueOnce(startResult.promise);
    const { result, unmount } = renderHook(() => useOrbConversation());

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.startListening();
      second = result.current.startListening();
    });
    await waitFor(() => expect(mocks.startDictation).toHaveBeenCalledTimes(1));
    await act(async () => {
      startResult.resolve({ success: true, sessionId: 'dictation-1' });
      await Promise.all([first, second]);
    });

    expect(result.current.state).toBe('listening');
    unmount();
  });

  it('ORB-VOICE-2: late final and timeout events cannot replace the active turn', async () => {
    mocks.startDictation.mockResolvedValueOnce({ success: true, sessionId: 'dictation-2' });
    const { result, unmount } = renderHook(() => useOrbConversation());
    await act(async () => { await result.current.startListening(); });

    act(() => {
      mocks.callbacks.partial?.({ sessionId: 'dictation-old', text: 'texto viejo' });
      mocks.callbacks.final?.({ sessionId: 'dictation-old', text: 'abre algo', reason: 'silence' });
      mocks.callbacks.error?.({ sessionId: 'dictation-old', reason: 'initial_silence' });
    });
    expect(result.current.state).toBe('listening');
    expect(result.current.transcript).toBe('');
    expect(mocks.sendMessageStream).not.toHaveBeenCalled();
    expect(mocks.hide).not.toHaveBeenCalled();

    act(() => {
      mocks.callbacks.final?.({ sessionId: 'dictation-2', text: 'abre configuracion', reason: 'silence' });
    });
    expect(result.current.state).toBe('thinking');
    expect(mocks.sendMessageStream).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ORB-VOICE-3: an unowned interrupted TTS event does not abort the agent or reopen listening', async () => {
    mocks.startDictation.mockResolvedValueOnce({ success: true, sessionId: 'dictation-3' });
    const { result, unmount } = renderHook(() => useOrbConversation());
    await act(async () => { await result.current.startListening(); });
    act(() => {
      mocks.callbacks.final?.({ sessionId: 'dictation-3', text: 'abre el navegador', reason: 'silence' });
    });
    expect(result.current.state).toBe('thinking');

    act(() => {
      mocks.callbacks.ttsEnd?.({ speechId: 'speech-ajeno', interrupted: true });
    });
    expect(result.current.state).toBe('thinking');
    expect(mocks.startDictation).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ORB-VOICE-4: a pending wake from an obsolete mount is ignored after cleanup', async () => {
    const pendingWake = deferred<{ success: boolean; wake: boolean }>();
    mocks.getPendingWake.mockReturnValueOnce(pendingWake.promise);
    const { unmount } = renderHook(() => useOrbConversation());
    unmount();

    await act(async () => {
      pendingWake.resolve({ success: true, wake: true });
      await pendingWake.promise;
      await Promise.resolve();
    });
    expect(mocks.startDictation).not.toHaveBeenCalled();
  });

  it('ORB-VOICE-5: StrictMode reuses the pending wake instead of consuming and losing it', async () => {
    const pendingWake = deferred<{ success: boolean; wake: boolean }>();
    mocks.getPendingWake.mockReturnValueOnce(pendingWake.promise);
    mocks.startDictation.mockResolvedValueOnce({ success: true, sessionId: 'dictation-strict' });
    const { unmount } = renderHook(() => useOrbConversation(), { wrapper: StrictMode });

    expect(mocks.getPendingWake).toHaveBeenCalledTimes(1);
    pendingWake.resolve({ success: true, wake: true });
    await waitFor(() => expect(mocks.startDictation).toHaveBeenCalledTimes(1));

    unmount();
  });

  // Pulse solo habla con la voz de Google Cloud: el respaldo local (Piper) se
  // retiro porque sonaba robotico y, al saltar en silencio, ocultaba el fallo real.
  it('ORB-VOICE-6: si el TTS de Google falla, muestra el motivo y no usa voz local', async () => {
    mocks.startDictation.mockResolvedValueOnce({ success: true, sessionId: 'dictation-sin-voz' });
    mocks.synthesizeCloudSpeech.mockRejectedValue(new Error('Cloud Text-to-Speech API has not been used'));
    mocks.sendMessageStream.mockResolvedValueOnce({
      stream: (async function* () { yield 'Respuesta sin voz.'; })(),
      sources: Promise.resolve(null),
    });
    const { result, unmount } = renderHook(() => useOrbConversation());
    await act(async () => { await result.current.startListening(); });
    act(() => {
      mocks.callbacks.final?.({
        sessionId: 'dictation-sin-voz', text: 'dime algo', reason: 'silence',
      });
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toMatch(/No pude responder con voz/);
    });
    // Nunca se recurre al TTS local del sidecar.
    expect(mocks.speak).not.toHaveBeenCalled();
    // El texto de la respuesta sigue visible para el usuario.
    expect(result.current.responseText).toBe('Respuesta sin voz.');
    unmount();
  });
});
