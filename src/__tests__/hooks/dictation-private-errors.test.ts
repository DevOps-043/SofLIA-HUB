import { afterEach, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ transcribe: vi.fn() }));
vi.mock('../../services/flow-service', () => ({ transcribeAudio: mocks.transcribe }));
import { useDictation } from '../../adapters/desktop_ui/chat-ui/useDictation';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('dictado informa un fallo público sin exponer contenido del proveedor', async () => {
  const secret = 'clave-ficticia contenido-privado'; mocks.transcribe.mockRejectedValueOnce(new Error(secret));
  class Recorder {
    static isTypeSupported() { return true; }
    state = 'inactive'; onstart?: () => void; ondataavailable?: (event: { data: Blob }) => void; onstop?: () => Promise<void>;
    start() { this.state = 'recording'; this.onstart?.(); this.ondataavailable?.({ data: new Blob(['x'.repeat(600)]) }); }
    stop() { this.state = 'inactive'; void this.onstop?.(); }
  }
  vi.stubGlobal('MediaRecorder', Recorder); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); const { result } = renderHook(() => useDictation(vi.fn()));
  await act(async () => result.current.toggleDictation()); await act(async () => result.current.stopDictation(true));
  await waitFor(() => expect(result.current.errorMessage).toBeTruthy());
  expect(result.current.errorMessage).not.toContain(secret); expect(JSON.stringify(spy.mock.calls)).not.toContain(secret); expect(result.current.isTranscribing).toBe(false);
});
