import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: vi.fn(async () => 'clave-ficticia') }));
import { generateImage } from '../../services/image-generation';
import { buildFallbackAnalysis } from '../../services/flow-service/fallback-analysis';
import { processFlowInput } from '../../services/flow-service/process-flow-input';
const detail = 'clave-ficticia contenido-privado /ruta-privada';
function logged(spy: ReturnType<typeof vi.spyOn>) { return spy.mock.calls.flat().map((value: unknown) => value instanceof Error ? value.message : JSON.stringify(value)).join(' '); }
afterEach(() => { vi.restoreAllMocks(); mock.generate.mockReset(); Reflect.deleteProperty(window, 'imageGeneration'); Reflect.deleteProperty(window, 'flowInference'); });
function installBridges() {
  window.imageGeneration = { generate: mock.generate };
  window.flowInference = { generate: mock.generate };
}
describe('Errores privados en generación', () => {
  it('imagen conserva mensaje público y no registra error del proveedor', async () => {
    installBridges(); mock.generate.mockRejectedValue(new Error(detail)); const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await generateImage('solicitud ficticia'); expect(result.text).not.toContain(detail); expect(logged(spy)).not.toContain(detail); expect(mock.generate).toHaveBeenCalled();
  });
  it('Flow conserva fallback y no registra detalle del proveedor', async () => {
    installBridges(); mock.generate.mockRejectedValue(new Error(detail)); const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await buildFallbackAnalysis('una solicitud ficticia'); expect(result.response).toContain('No pude'); expect(logged(spy)).not.toContain(detail); expect(mock.generate).toHaveBeenCalled();
  });
  it('el análisis y su fallback no escriben el detalle del proveedor', async () => {
    installBridges(); mock.generate.mockRejectedValue(new Error(detail)); const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await processFlowInput('Describe brevemente una idea ficticia'); expect(result.response).toBeTruthy(); expect(logged(spy)).not.toContain(detail); expect(mock.generate).toHaveBeenCalled();
  });
});
