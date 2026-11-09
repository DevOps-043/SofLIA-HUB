import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getKey: vi.fn() }));
vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: mocks.getKey }));
import { generateImage } from '../../services/image-generation';
beforeEach(() => { vi.clearAllMocks(); mocks.getKey.mockResolvedValue('clave-standalone'); });
afterEach(() => { vi.unstubAllGlobals(); });
describe('Generación de imagen en Electron y navegador', () => {
  it('en Electron usa main sin consultar ni construir cliente con clave en renderer', async () => {
    const generate = vi.fn(async (prompt: string) => ({ success: true as const, text: prompt ? 'Imagen lista' : '', imageData: 'data:image/png;base64,QUJD' })); vi.stubGlobal('window', { imageGeneration: { generate }, ipcRenderer: {} });
    const result = await generateImage('una escena', { artDirection: 'acuarela' }); expect(result.imageData).toBe('data:image/png;base64,QUJD'); expect(generate).toHaveBeenCalledOnce(); expect(generate.mock.calls[0][0]).toContain('acuarela'); expect(mocks.getKey).not.toHaveBeenCalled();
  });
  it('Electron sin bridge falla cerrado y no busca clave en renderer', async () => {
    vi.stubGlobal('window', { ipcRenderer: {} }); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await generateImage('una escena'); expect(result.text).toContain('No pude'); expect(mocks.getKey).not.toHaveBeenCalled(); log.mockRestore();
  });
  it('requiere escritorio para generar imágenes y no consulta claves del navegador', async () => {
    vi.stubGlobal('window', {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await generateImage('una escena')).text).toContain('No pude');
    expect(mocks.getKey).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
