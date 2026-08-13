import { describe, expect, it, vi } from 'vitest';
import {
  clearBrowsingData,
  rangeStartIso,
  validateBrowsingDataRequest,
  type BrowsingDataDeps,
} from '../integrated-browser/browsing-data';

const AHORA = Date.parse('2026-08-12T12:00:00.000Z');

function makeDeps(overrides: Partial<BrowsingDataDeps> = {}): BrowsingDataDeps {
  return {
    clearHistorySince: vi.fn(async () => 12),
    clearSiteData: vi.fn(async () => undefined),
    clearCache: vi.fn(async () => undefined),
    clearPasswords: vi.fn(async () => 3),
    clearSitePermissions: vi.fn(async () => 5),
    now: () => AHORA,
    ...overrides,
  };
}

describe('rango de borrado', () => {
  it('traduce cada rango a un inicio concreto', () => {
    expect(rangeStartIso('ultima-hora', AHORA)).toBe('2026-08-12T11:00:00.000Z');
    expect(rangeStartIso('ultimo-dia', AHORA)).toBe('2026-08-11T12:00:00.000Z');
    expect(rangeStartIso('ultima-semana', AHORA)).toBe('2026-08-05T12:00:00.000Z');
    expect(rangeStartIso('ultimo-mes', AHORA)).toBe('2026-07-15T12:00:00.000Z');
  });

  it('devuelve null para "todo", que significa sin acotar', () => {
    expect(rangeStartIso('todo', AHORA)).toBeNull();
  });
});

describe('validacion del payload', () => {
  it('acepta una peticion valida y deduplica categorias', () => {
    expect(validateBrowsingDataRequest({ categories: ['cookies', 'cookies', 'cache'], range: 'todo' }))
      .toEqual({ categories: ['cookies', 'cache'], range: 'todo' });
  });

  it.each([
    ['sin categorias', { categories: [], range: 'todo' }],
    ['categorias ausentes', { range: 'todo' }],
    ['categorias que no son lista', { categories: 'cookies', range: 'todo' }],
  ])('rechaza %s', (_label, payload) => {
    expect(() => validateBrowsingDataRequest(payload)).toThrow('al menos un tipo de dato');
  });

  it('rechaza una categoria desconocida', () => {
    expect(() => validateBrowsingDataRequest({ categories: ['marcadores'], range: 'todo' }))
      .toThrow('Tipo de dato de navegacion no reconocido.');
  });

  it('rechaza un rango desconocido', () => {
    expect(() => validateBrowsingDataRequest({ categories: ['cookies'], range: 'ultimo-siglo' }))
      .toThrow('Rango de borrado no reconocido.');
  });

  it('rechaza un payload vacio o nulo', () => {
    expect(() => validateBrowsingDataRequest(null)).toThrow();
    expect(() => validateBrowsingDataRequest(undefined)).toThrow();
  });
});

describe('borrado de datos de navegacion', () => {
  it('acota el historial al rango elegido', async () => {
    const deps = makeDeps();
    const summary = await clearBrowsingData({ categories: ['historial'], range: 'ultima-hora' }, deps);

    expect(deps.clearHistorySince).toHaveBeenCalledWith('2026-08-12T11:00:00.000Z');
    expect(summary.results[0]).toMatchObject({
      category: 'historial',
      cleared: true,
      removed: 12,
      ignoredRange: false,
    });
  });

  it('borra todo el historial cuando el rango es "todo"', async () => {
    const deps = makeDeps();
    await clearBrowsingData({ categories: ['historial'], range: 'todo' }, deps);
    expect(deps.clearHistorySince).toHaveBeenCalledWith(null);
  });

  it('declara que cookies y cache ignoran el rango en vez de aparentar que lo respetan', async () => {
    const deps = makeDeps();
    const summary = await clearBrowsingData({ categories: ['cookies', 'cache'], range: 'ultimo-dia' }, deps);

    expect(summary.results.map((result) => result.ignoredRange)).toEqual([true, true]);
    expect(deps.clearSiteData).toHaveBeenCalledTimes(1);
    expect(deps.clearCache).toHaveBeenCalledTimes(1);
  });

  it('no marca ignoredRange cuando el rango ya era "todo"', async () => {
    const summary = await clearBrowsingData({ categories: ['cookies', 'contrasenas'], range: 'todo' }, makeDeps());
    expect(summary.results.every((result) => result.ignoredRange === false)).toBe(true);
  });

  it('informa cuantas contrasenas y permisos quito', async () => {
    const summary = await clearBrowsingData({ categories: ['contrasenas', 'permisos'], range: 'todo' }, makeDeps());

    expect(summary.results).toEqual([
      { category: 'contrasenas', cleared: true, removed: 3, ignoredRange: false },
      { category: 'permisos', cleared: true, removed: 5, ignoredRange: false },
    ]);
  });

  it('solo toca las categorias pedidas', async () => {
    const deps = makeDeps();
    await clearBrowsingData({ categories: ['cache'], range: 'todo' }, deps);

    expect(deps.clearCache).toHaveBeenCalledTimes(1);
    expect(deps.clearHistorySince).not.toHaveBeenCalled();
    expect(deps.clearSiteData).not.toHaveBeenCalled();
    expect(deps.clearPasswords).not.toHaveBeenCalled();
    expect(deps.clearSitePermissions).not.toHaveBeenCalled();
  });

  it('un fallo de una categoria no impide borrar las demas', async () => {
    const deps = makeDeps({
      clearSiteData: vi.fn(async () => {
        throw new Error('la particion esta ocupada');
      }),
    });

    const summary = await clearBrowsingData({ categories: ['cookies', 'historial'], range: 'todo' }, deps);

    expect(summary.results[0]).toMatchObject({ category: 'cookies', cleared: false, error: 'la particion esta ocupada' });
    expect(summary.results[1]).toMatchObject({ category: 'historial', cleared: true, removed: 12 });
    expect(deps.clearHistorySince).toHaveBeenCalled();
  });

  it('sanea el mensaje de error de una categoria fallida', async () => {
    const deps = makeDeps({
      clearPasswords: vi.fn(async () => {
        throw new Error('boveda danada\n\ttraza interna');
      }),
    });

    const summary = await clearBrowsingData({ categories: ['contrasenas'], range: 'todo' }, deps);
    expect(summary.results[0].error).toBe('boveda danada traza interna');
  });

  it('conserva el rango pedido en el resumen', async () => {
    const summary = await clearBrowsingData({ categories: ['historial'], range: 'ultima-semana' }, makeDeps());
    expect(summary.range).toBe('ultima-semana');
  });
});
