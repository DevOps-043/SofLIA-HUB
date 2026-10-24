import { describe, expect, it, vi } from 'vitest';
import { PythonToolsService } from '../python-tools-service';
import { projectDocument, projectPii, projectRedaction, toolsFailure } from '../python/tools-contract';
import { SidecarConnectionError } from '../python/sidecar-connection';
const document = () => ({ markdown: 'Texto ficticio', tables: [{ sheet: '[EMAIL]', rows: [['celda']] }], metadata: { format: 'xlsx', sizeBytes: 100, piiRedacted: 1, piiEngine: 'soflia-regex-mx', privatePath: 'C:/no-publicar' }, raw: 'no-publicar' });
describe('Proyección de resultados Python', () => {
  it('comunica dependencia incompatible sin divulgar versión ni rutas', () => {
    expect(toolsFailure('DEPENDENCY_INCOMPATIBLE')).toMatchObject({ success: false, error: { code: 'DEPENDENCY_INCOMPATIBLE', message: expect.stringContaining('actualizadas') } });
  });
  it('proyecta el rechazo de recursos como error público accionable', () => {
    expect(toolsFailure('DOC_RESOURCE_LIMIT')).toMatchObject({ success: false, error: { code: 'DOC_RESOURCE_LIMIT', message: expect.stringContaining('documento menor') } });
  });
  it('agotar una lectura retira al hijo actual y difiere limpieza hasta su cierre real', async () => {
    const service = new PythonToolsService(); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    let close!: () => void;
    const a = { request: vi.fn(async () => { throw new SidecarConnectionError('TIMEOUT', 'fallo ficticio'); }),
      stop: vi.fn(async () => { throw new SidecarConnectionError('SIDECAR_STOP_UNCONFIRMED', 'Cierre no confirmado.'); }), closed: new Promise<void>(resolve => { close = resolve; }) };
    Object.assign(service, { connection: a }); vi.spyOn(service as unknown as { ensureProcess(): Promise<unknown> }, 'ensureProcess').mockResolvedValue(a);
    expect(await service.analyzePii('texto')).toMatchObject({ success: false, error: { code: 'SIDECAR_STOP_UNCONFIRMED' } });
    expect(a.stop).toHaveBeenCalledOnce(); const remove = vi.fn(async () => {});
    expect(await service.releaseDocumentCopy(remove)).toBe(false); expect(remove).not.toHaveBeenCalled();
    close(); await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });
  it('retira campos desconocidos sin copiar rutas o datos libres', () => {
    const result = projectDocument(document(), true); expect(result.metadata).not.toHaveProperty('privatePath'); expect(result).not.toHaveProperty('raw');
  });
  it('no acepta una supuesta lectura protegida sin declaración de redacción', () => {
    expect(() => projectDocument({ ...document(), metadata: {} }, true)).toThrow('TOOLS_INVALID_RESPONSE');
  });
  it('rechaza presupuesto acumulado de celdas antes de clonar estructuras grandes', () => {
    expect(() => projectDocument({ ...document(), tables: [{ rows: Array.from({ length: 101 }, () => Array(200).fill('')) }] }, false)).toThrow();
    expect(() => projectDocument({ ...document(), tables: [{ rows: [['x'.repeat(400001)]] }] }, false)).toThrow();
  });
  it('valida posiciones Unicode, orden y campos públicos de entidades', () => {
    const result = projectPii({ entities: [{ type: 'EMAIL', start: 1, end: 2, text: 'privado' }], engine: 'soflia-regex-mx' }, '😀x');
    expect(result.entities[0]).not.toHaveProperty('text');
    expect(() => projectPii({ entities: [{ type: 'EMAIL', start: 1, end: 3 }], engine: 'soflia-regex-mx' }, '😀x')).toThrow();
    expect(() => projectRedaction({ ...result, redacted: '[EMAIL]', redactedCount: 99 }, '😀x')).toThrow();
  });
  it('un fallo anterior no cambia el diagnóstico del hijo nuevo', async () => {
    const service = new PythonToolsService(); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    let reject!: (error: Error) => void;
    const promise = new Promise<Record<string, unknown>>((_resolve, fail) => { reject = fail; });
    const a = { request: vi.fn(() => promise) }; const b = {};
    Object.assign(service, { connection: a });
    vi.spyOn(service as unknown as { ensureProcess(): Promise<unknown> }, 'ensureProcess').mockResolvedValue(a);
    const pending = service.analyzePii('texto'); await vi.waitFor(() => expect(a.request).toHaveBeenCalled());
    Object.assign(service, { connection: b, lifecycleVersion: 1, lastError: null });
    reject(new SidecarConnectionError('TIMEOUT', 'fallo-anterior')); expect((await pending).success).toBe(false);
    expect(service.getStatus().lastError).toBeNull();
  });
});
