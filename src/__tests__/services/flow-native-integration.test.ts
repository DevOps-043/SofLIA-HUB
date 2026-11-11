import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getKey: vi.fn() }));
vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: mocks.getKey }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } } }));
import { processFlowInput } from '../../services/flow-service/process-flow-input';
import { transcribeAudio } from '../../services/flow-service/transcription';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('Uso nativo de Flow', () => {
  it('rechaza audio excesivo antes de leerlo o consultar al proveedor', async () => {
    const generate = vi.fn(); vi.stubGlobal('window', { ipcRenderer: {}, flowInference: { generate } });
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const audio = new Blob(['x'], { type: 'audio/webm' }); Object.defineProperty(audio, 'size', { value: 12 * 1024 * 1024 + 1 });
    try { await expect(transcribeAudio(audio)).rejects.toThrow('El audio excede'); expect(read).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled(); expect(mocks.getKey).not.toHaveBeenCalled(); }
    finally { read.mockRestore(); }
  });
  it('análisis y dictado no obtienen claves en renderer', async () => {
    const generate = vi.fn(async (request: { kind: string }) => request.kind === 'transcription' ? { success: true, text: '{"transcript":"hola"}' } : { success: true, text: '{"response":"respuesta"}' });
    vi.stubGlobal('window', { ipcRenderer: {}, flowInference: { generate } });
    expect((await processFlowInput('Explica esta idea ficticia')).response).toBe('respuesta'); expect(await transcribeAudio(new Blob(['audio'], { type: 'audio/webm' }))).toBe('hola');
    expect(generate).toHaveBeenCalledTimes(2); expect(mocks.getKey).not.toHaveBeenCalled();
  });
  it('revocación nativa detiene reintentos incluso antes del evento renderer', async () => {
    const generate = vi.fn(async () => ({ success: false, code: 'revoked', error: 'sesión revocada' })); vi.stubGlobal('window', { ipcRenderer: {}, flowInference: { generate } });
    await expect(processFlowInput('Describe esta imagen con detalle', 'QUJD')).rejects.toThrow('sesión revocada'); expect(generate).toHaveBeenCalledOnce(); expect(mocks.getKey).not.toHaveBeenCalled();
  });
});
