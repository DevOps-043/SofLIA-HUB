import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ callbacks: new Set<(event: string) => void>(), generate: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: (cb: (event: string) => void) => { mocks.callbacks.add(cb); return { data: { subscription: { unsubscribe: () => { mocks.callbacks.delete(cb); } } } }; } } } }));
import { processFlowInput } from '../../services/flow-service/process-flow-input';
import { transcribeAudio } from '../../services/flow-service/transcription';
function change() { for (const cb of mocks.callbacks) { cb('SIGNED_OUT'); cb('SIGNED_IN'); } }
beforeEach(() => { vi.stubGlobal('window', { flowInference: { generate: mocks.generate } }); mocks.generate.mockReset(); mocks.callbacks.clear(); });
afterEach(() => { expect(mocks.callbacks.size).toBe(0); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Vigencia de sesión de Flow', () => {
  it('no reintenta ni inicia fallback después de cambiar de sesión', async () => {
    let reject!: (error: Error) => void; mocks.generate.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const pending = processFlowInput('Describe esta imagen con detalle', 'QUJD'); await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
    change(); reject(new Error('fallo')); await expect(pending).rejects.toThrow(); expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it('mantiene recuperación ante error con sesión vigente', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.generate.mockRejectedValueOnce(new Error('fallo temporal')).mockResolvedValueOnce({ success: true, text: 'Respuesta alternativa' });
    const result = await processFlowInput('Explica esta idea ficticia'); expect(result.response).toBe('Respuesta alternativa'); expect(mocks.generate).toHaveBeenCalledTimes(2); log.mockRestore();
  });
  it('no publica un análisis que llega tras el cambio de sesión', async () => {
    let finish!: (value: unknown) => void; mocks.generate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = processFlowInput('Explica esta idea ficticia'); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    change(); finish({ success: true, text: JSON.stringify({ response: 'respuesta anterior' }) }); await expect(pending).rejects.toThrow(); expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it('descarta una transcripción anterior', async () => {
    let finish!: (value: unknown) => void; mocks.generate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = transcribeAudio(new Blob(['audio ficticio'], { type: 'audio/webm' })); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    change(); finish({ success: true, text: JSON.stringify({ transcript: 'texto anterior' }) }); await expect(pending).rejects.toThrow();
  });
});
