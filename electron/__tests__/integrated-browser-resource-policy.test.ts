import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserResourcePolicy } from '../integrated-browser/resource-policy';

function fixture() {
  const tabs = ['primaria', 'fría', 'reciente'].map((id, index) => ({ id, lastActivatedAt: index * 10 }));
  const live = new Set(tabs);
  const protectedWork = new Set<string>();
  const layout = new Set(['primaria']);
  const presented = new Set(['primaria']);
  const ports = {
    liveTabs: vi.fn(() => [...live]),
    isLayoutProtected: (tab: typeof tabs[number]) => layout.has(tab.id),
    isPresented: (tab: typeof tabs[number]) => presented.has(tab.id),
    hasProtectedWork: vi.fn((tab: typeof tabs[number]) => protectedWork.has(tab.id)),
    isParentUsable: vi.fn(() => true),
    setThrottling: vi.fn(),
    retire: vi.fn((tab: typeof tabs[number]) => { live.delete(tab); }),
    changed: vi.fn(),
    periodicError: vi.fn(),
  };
  const limits = { maxLiveTabs: 3, warmBackgroundTabs: 1, coldGraceMs: 90_000, hiddenGraceMs: 30_000, retryMs: 30_000 };
  const policy = new BrowserResourcePolicy(ports, limits);
  return { tabs, live, protectedWork, layout, presented, ports, limits, policy };
}

describe('Política de recursos del navegador', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('retira la candidata LRU y conserva disposición y trabajo protegido', () => {
    const f = fixture();
    f.limits.maxLiveTabs = 1;
    f.protectedWork.add('fría');
    expect(f.policy.enforceBudget()).toBe(true);
    expect([...f.live].map(tab => tab.id)).toEqual(['primaria', 'fría']);
    expect(f.ports.retire).toHaveBeenCalledWith(f.tabs[2]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('recupera el presupuesto tras cesar el trabajo usando estado actual', () => {
    const f = fixture();
    f.limits.maxLiveTabs = 2;
    f.protectedWork.add('fría');
    f.protectedWork.add('reciente');
    expect(f.policy.enforceBudget()).toBe(false);
    f.protectedWork.delete('fría');
    vi.advanceTimersByTime(30_000);
    expect([...f.live].map(tab => tab.id)).toEqual(['primaria', 'reciente']);
    expect(f.ports.changed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ordena por activación aunque la enumeración tenga otro orden', () => {
    const f = fixture();
    f.tabs[1].lastActivatedAt = 50;
    f.limits.maxLiveTabs = 2;
    f.policy.enforceBudget();
    expect(f.ports.retire).toHaveBeenCalledWith(f.tabs[2]);
  });

  it('respeta la gracia, la pestaña warm y el throttling de las presentadas', () => {
    const f = fixture();
    f.policy.reconcile();
    expect(f.ports.setThrottling.mock.calls).toEqual([[f.tabs[0], false], [f.tabs[1], true], [f.tabs[2], true]]);
    vi.advanceTimersByTime(90_009);
    expect(f.ports.retire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f.ports.retire).toHaveBeenCalledExactlyOnceWith(f.tabs[1]);
    expect([...f.live].map(tab => tab.id)).toEqual(['primaria', 'reciente']);
  });

  it('usa la gracia menor de ventana oculta', () => {
    const f = fixture();
    f.ports.isParentUsable.mockReturnValue(false);
    f.policy.reconcile();
    vi.advanceTimersByTime(30_010);
    expect(f.ports.retire).toHaveBeenCalledExactlyOnceWith(f.tabs[1]);
  });

  it('conserva trabajo protegido al vencer la gracia y reintenta después', () => {
    const f = fixture();
    f.protectedWork.add('fría');
    f.policy.reconcile();
    vi.advanceTimersByTime(90_010);
    expect(f.ports.retire).not.toHaveBeenCalled();
    f.protectedWork.clear();
    vi.advanceTimersByTime(30_000);
    expect(f.ports.retire).toHaveBeenCalledExactlyOnceWith(f.tabs[1]);
  });

  it('recalcula presentación y warm al dispararse el timer', () => {
    const f = fixture();
    f.policy.reconcile();
    f.presented.add('fría');
    vi.advanceTimersByTime(90_010);
    expect(f.ports.retire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mantiene el vencimiento cercano al pedir otro retry de presupuesto', () => {
    const f = fixture();
    vi.setSystemTime(89_000);
    f.policy.reconcile();
    f.limits.maxLiveTabs = 1;
    f.protectedWork.add('fría');
    f.protectedWork.add('reciente');
    f.policy.enforceBudget();
    f.ports.hasProtectedWork.mockClear();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1_010);
    expect(f.ports.hasProtectedWork).toHaveBeenCalledWith(f.tabs[1]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('stop cancela e invalida incluso un callback ya retenido', () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const f = fixture();
    f.policy.reconcile();
    const callback = timeout.mock.calls[0][0] as () => void;
    f.policy.stop();
    f.ports.liveTabs.mockClear();
    callback();
    expect(f.ports.liveTabs).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('el timer del perfil anterior no consulta pestañas del nuevo perfil', () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const f = fixture();
    f.policy.reconcile();
    const previous = timeout.mock.calls[0][0] as () => void;
    f.policy.stop();
    f.live.clear();
    f.policy.reconcile();
    f.ports.liveTabs.mockClear();
    previous();
    expect(f.ports.liveTabs).not.toHaveBeenCalled();
  });

  it('un error periódico se reporta sin payload y conserva un solo retry', () => {
    const f = fixture();
    f.policy.reconcile();
    f.ports.liveTabs.mockImplementationOnce(() => { throw new Error('URL privada'); });
    vi.advanceTimersByTime(90_010);
    expect(f.ports.periodicError).toHaveBeenCalledExactlyOnceWith();
    expect(f.ports.changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(30_000);
    expect(f.ports.retire).toHaveBeenCalledExactlyOnceWith(f.tabs[1]);
  });

  it('no rearma un error cuando el propietario ya detuvo la política', () => {
    const f = fixture();
    f.policy.reconcile();
    f.ports.liveTabs.mockImplementationOnce(() => { f.policy.stop(); throw new Error('cierre'); });
    vi.advanceTimersByTime(90_010);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('publica retiradas parciales aunque falle después el throttling de otra vista', () => {
    const f = fixture();
    f.policy.reconcile();
    f.ports.setThrottling.mockImplementation(tab => {
      if (tab === f.tabs[2]) throw new Error('vista destruida');
    });
    vi.advanceTimersByTime(90_010);
    expect(f.ports.retire).toHaveBeenCalledExactlyOnceWith(f.tabs[1]);
    expect(f.ports.changed).toHaveBeenCalledTimes(1);
    expect(f.ports.periodicError).toHaveBeenCalledExactlyOnceWith();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('propaga fallos síncronos de retirada sin declarar cambio exitoso', () => {
    const f = fixture();
    f.limits.maxLiveTabs = 2;
    f.ports.retire.mockImplementation(() => { throw new Error('nativo'); });
    expect(() => f.policy.enforceBudget()).toThrow('nativo');
    expect(f.live.size).toBe(3);
    expect(f.ports.changed).not.toHaveBeenCalled();
  });

  it('no rearma el presupuesto si una retirada provoca el cierre del propietario', () => {
    const f = fixture();
    f.limits.maxLiveTabs = 1;
    f.ports.retire.mockImplementation(tab => { f.live.delete(tab); f.policy.stop(); });
    f.policy.enforceBudget();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.ports.retire).toHaveBeenCalledTimes(1);
  });

  it('no acumula timers al reconciliar repetidamente ni al quedarse sin vistas', () => {
    const f = fixture();
    f.policy.reconcile();
    f.policy.reconcile();
    expect(vi.getTimerCount()).toBe(1);
    f.live.clear();
    expect(f.policy.reconcile()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
