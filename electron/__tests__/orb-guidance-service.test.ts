import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrbGuidanceService } from '../orb-guidance/service';
import type { GuidanceTarget } from '../../src/shared/orb-guidance';

const target: GuidanceTarget = { point: { x: 600, y: 300 }, rect: { x: 550, y: 280, width: 100, height: 40 } };
const definition = { title: 'Insertar tabla', steps: [{ instruction: 'Abre Insertar', targetText: 'Insertar', expectedText: 'Tabla dinámica' }] };
function fixture() {
  const surfaces = { render: vi.fn(async (): Promise<void> => undefined), clear: vi.fn(), suspend: vi.fn(), capture: async <T>(operation: () => Promise<T>) => operation() };
  const locate = vi.fn(async (text: string): Promise<GuidanceTarget | null> => { void text; return target; });
  const authorized = vi.fn(() => true);
  return { surfaces, locate, authorized, service: new OrbGuidanceService({ surfaces, locate, authorized }) };
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
afterEach(() => vi.useRealTimers());

describe('guía visual y prácticas de escritorio', () => {
  it('presenta geometría y caduca incluso después de cambiar el estilo', async () => {
    vi.useFakeTimers(); const { service, surfaces } = fixture();
    const pending = service.present({ target, instruction: 'Selecciona Insertar' });
    await vi.advanceTimersByTimeAsync(180); await pending;
    expect(surfaces.render).toHaveBeenCalledWith(expect.objectContaining({ target, phase: 'presenting' }));
    service.control({ action: 'style', style: 'arrow' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(service.getState().target).toBeNull(); expect(surfaces.suspend).toHaveBeenCalled();
    service.clear();
  });
  it('no concede acción después de cancelar una presentación pendiente', async () => {
    const { service, surfaces } = fixture(); const rendered = deferred<void>();
    surfaces.render.mockReturnValueOnce(rendered.promise);
    const pending = service.present({ target, instruction: 'Selecciona' });
    const rejected = expect(pending).rejects.toThrow('cancelada');
    await vi.waitFor(() => expect(surfaces.render).toHaveBeenCalled());
    service.clear(); rendered.resolve(); await rejected;
    expect(service.getState().phase).toBe('idle');
  });
  it('pausa espera y al reanudar rechaza la coordenada previa para exigir nueva observación', async () => {
    const { service, surfaces } = fixture(); service.control({ action: 'pause' });
    const pending = service.present({ target, instruction: 'Selecciona' });
    const rejected = expect(pending).rejects.toThrow('cancelada');
    await Promise.resolve(); expect(surfaces.render).not.toHaveBeenCalled();
    service.control({ action: 'resume' }); await rejected;
  });
  it('cancelación libera una espera pausada sin volver a actuar', async () => {
    const { service } = fixture(); const controller = new AbortController();
    service.control({ action: 'pause' });
    const rejected = expect(service.wait(controller.signal)).rejects.toThrow('cancelada');
    controller.abort(); await rejected;
  });
  it('rechaza coordenadas no finitas y una sesión no autorizada', async () => {
    const { service, authorized, surfaces } = fixture();
    await expect(service.present({ target: { point: { x: NaN, y: 1 } }, instruction: 'Selecciona' })).rejects.toThrow('no es válido');
    authorized.mockReturnValue(false);
    await expect(service.present({ target, instruction: 'Selecciona' })).rejects.toThrow('cancelada');
    expect(surfaces.render).not.toHaveBeenCalled();
  });
  it('no avanza si el resultado esperado está ausente y sí completa cuando aparece', async () => {
    const { service, locate } = fixture(); await service.startPractice(definition);
    locate.mockImplementation(async text => text === 'Tabla dinámica' ? null : target);
    await service.checkPractice();
    expect(service.getState()).toMatchObject({ phase: 'practice', practice: { step: 1 } });
    locate.mockResolvedValue(target); await service.checkPractice();
    expect(service.getState().phase).toBe('complete'); service.clear();
  });
  it('un fallo de comprobación permite reintentar', async () => {
    const { service, locate } = fixture(); await service.startPractice(definition);
    locate.mockRejectedValueOnce(new Error('captura fallida')); await service.checkPractice();
    expect(service.getState().phase).toBe('practice');
    await service.checkPractice(); expect(service.getState().phase).toBe('complete'); service.clear();
  });
  it('un rechazo antiguo no borra una práctica nueva', async () => {
    const { service, locate, surfaces } = fixture(); const old = deferred<GuidanceTarget | null>();
    locate.mockReturnValueOnce(old.promise);
    const pending = service.startPractice(definition);
    await vi.waitFor(() => expect(locate).toHaveBeenCalledTimes(1));
    await service.startPractice({ ...definition, title: 'Nueva práctica' });
    const clearCount = surfaces.clear.mock.calls.length;
    old.reject(new Error('respuesta antigua')); await pending;
    expect(surfaces.clear).toHaveBeenCalledTimes(clearCount);
    expect(service.getState().practice?.title).toBe('Nueva práctica'); service.clear();
  });
  it('una comprobación tardía no completa una práctica cancelada', async () => {
    const { service, locate } = fixture(); await service.startPractice(definition);
    const result = deferred<GuidanceTarget | null>(); locate.mockReturnValueOnce(result.promise);
    const pending = service.checkPractice(); service.clear(); result.resolve(target); await pending;
    expect(service.getState().phase).toBe('idle');
  });
  it('la práctica impide que Computer Use tome el control', async () => {
    const { service } = fixture(); await service.startPractice(definition);
    await expect(service.wait()).rejects.toThrow('cancelada'); service.clear();
  });
  it('un objetivo antiguo no reemplaza una solicitud más reciente', async () => {
    vi.useFakeTimers(); const { service, locate } = fixture(); const old = deferred<GuidanceTarget | null>();
    locate.mockReturnValueOnce(old.promise);
    const pending = service.showTarget({ targetText: 'Antiguo', instruction: 'Antiguo' });
    const rejected = expect(pending).rejects.toThrow('cancelada');
    const newer = service.showTarget({ targetText: 'Nuevo', instruction: 'Nuevo' });
    await vi.advanceTimersByTimeAsync(180); await newer;
    old.resolve(target); await rejected;
    expect(service.getState().instruction).toBe('Nuevo'); service.clear();
  });
  it('la pérdida del emisor durante la localización no dibuja marcas', async () => {
    const { service, locate, surfaces } = fixture(); const found = deferred<GuidanceTarget | null>();
    locate.mockReturnValueOnce(found.promise); let alive = true;
    const assertCurrent = () => { if (!alive) throw new Error('Ventana reemplazada'); };
    const pending = service.showTarget({ targetText: 'Guardar', instruction: 'Selecciona' }, assertCurrent);
    const rejected = expect(pending).rejects.toThrow('reemplazada'); alive = false; found.resolve(target); await rejected;
    expect(surfaces.render).not.toHaveBeenCalled();
  });
  it('una guarda adquirida antes de detener no vuelve a autorizar efectos', () => {
    const { service } = fixture(); const guard = service.createGuard(); guard(); service.clear();
    expect(guard).toThrow('cancelada');
  });
  it('espera un cambio de estilo iniciado durante la ventana previa a actuar', async () => {
    vi.useFakeTimers(); const { service, surfaces } = fixture(); const changed = deferred<void>();
    surfaces.render.mockResolvedValueOnce().mockReturnValueOnce(changed.promise);
    let permitted = false;
    const pending = service.present({ target, instruction: 'Selecciona' }).then(() => { permitted = true; });
    await vi.advanceTimersByTimeAsync(100); service.control({ action: 'style', style: 'arrow' });
    await vi.advanceTimersByTimeAsync(80); expect(permitted).toBe(false);
    changed.resolve(); await pending; expect(permitted).toBe(true); service.clear();
  });
});
