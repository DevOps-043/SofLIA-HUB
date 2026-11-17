import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); });

describe('Diagnóstico temporal del bootstrap', () => {
  it('incluye evaluación estática previa y mantiene diferencias entre hitos', async () => {
    vi.resetModules();
    const now = vi.spyOn(performance, 'now').mockReturnValue(10000);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { markBoot, bootElapsedMs } = await import('../main/boot-timeline');

    now.mockReturnValue(12000);
    markBoot('main:entrada');
    expect(log).toHaveBeenLastCalledWith('[BOOT] hito fase=main:entrada t_relativo_ms=12000 duracion_ms=12000');

    now.mockReturnValue(12500);
    markBoot('modulos:fin');
    expect(log).toHaveBeenLastCalledWith('[BOOT] hito fase=modulos:fin t_relativo_ms=12500 duracion_ms=500');
    now.mockReturnValue(12580);
    expect(bootElapsedMs()).toBe(12580);
  });
});
