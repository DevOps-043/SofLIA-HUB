import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateNativeFlow, NativeFlowRevokedError } from '../../services/flow-service/native';
afterEach(() => vi.unstubAllGlobals());
describe('Puente Flow', () => {
  it('requiere la aplicación de escritorio', async () => { vi.stubGlobal('window', {}); await expect(generateNativeFlow({ kind: 'analysis', text: 'x' })).rejects.toThrow('escritorio'); });
  it('Electron sin puente falla cerrado', async () => { vi.stubGlobal('window', { ipcRenderer: {} }); await expect(generateNativeFlow({ kind: 'analysis', text: 'x' })).rejects.toThrow(); });
  it('conserva la revocación para detener reintentos', async () => { vi.stubGlobal('window', { flowInference: { generate: vi.fn(async () => ({ success: false, code: 'revoked', error: 'cancelado' })) } }); await expect(generateNativeFlow({ kind: 'analysis', text: 'x' })).rejects.toBeInstanceOf(NativeFlowRevokedError); });
});
