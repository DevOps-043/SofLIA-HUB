import { describe, expect, it, vi } from 'vitest';
import { availableLevelsFor, buildInventory, type InventoryDeps } from '../desktop-context/inventory';

function makeDeps(overrides: Partial<InventoryDeps> = {}): InventoryDeps {
  return {
    listWindows: vi.fn(async () => [
      { title: 'Presupuesto 2026 - Excel', process: 'EXCEL', pid: 4321 },
      { title: 'Contrato - Word', process: 'WINWORD', pid: 4322 },
      { title: 'Notas', process: 'notepad', pid: 4323 },
    ]),
    getWindowSources: vi.fn(async () => [
      { id: 'window:1:0', name: 'Presupuesto 2026 - Excel', thumbnail: 'data:image/png;base64,excel' },
      { id: 'window:2:0', name: 'Notas', thumbnail: 'data:image/png;base64,notas' },
    ]),
    ownWindowTitles: () => ['Pulse Hub'],
    ownPid: 999,
    platform: 'win32',
    ...overrides,
  };
}

describe('inventario de aplicaciones de escritorio', () => {
  it('lista ventanas con miniatura y nivel previsto sin leer contenido', async () => {
    const deps = makeDeps();
    const { inventory } = await buildInventory(deps);

    expect(inventory.candidates).toHaveLength(3);
    expect(inventory.availableLevels).toEqual(['documento', 'accesibilidad', 'captura']);

    const excel = inventory.candidates.find((item) => item.appName === 'EXCEL');
    expect(excel?.expectedLevel).toBe('documento');
    expect(excel?.thumbnail).toBe('data:image/png;base64,excel');

    const notepad = inventory.candidates.find((item) => item.appName === 'notepad');
    // Sin COM detras, una app corriente se lee por accesibilidad.
    expect(notepad?.expectedLevel).toBe('accesibilidad');

    // Word no tenia fuente de captura: se lista igual, sin miniatura.
    const word = inventory.candidates.find((item) => item.appName === 'WINWORD');
    expect(word?.thumbnail).toBe('');
  });

  it('no expone el sourceId al renderer pero lo conserva para capturar', async () => {
    const { inventory, records } = await buildInventory(makeDeps());

    expect(inventory.candidates.every((candidate) => !('sourceId' in candidate))).toBe(true);
    expect(records.find((record) => record.appName === 'EXCEL')?.sourceId).toBe('window:1:0');
  });

  it('excluye las ventanas del propio Pulse Hub por pid y por titulo', async () => {
    const deps = makeDeps({
      listWindows: vi.fn(async () => [
        { title: 'Pulse Hub', process: 'electron', pid: 100 },
        { title: 'Otra ventana de Pulse Hub', process: 'electron', pid: 999 },
        { title: 'Notas', process: 'notepad', pid: 4323 },
      ]),
      ownWindowTitles: () => ['Pulse Hub'],
      ownPid: 999,
    });

    const { inventory } = await buildInventory(deps);
    expect(inventory.candidates.map((candidate) => candidate.title)).toEqual(['Notas']);
  });

  it('descarta ventanas sin titulo', async () => {
    const deps = makeDeps({
      listWindows: vi.fn(async () => [
        { title: '   ', process: 'svchost', pid: 10 },
        { title: 'Notas', process: 'notepad', pid: 11 },
      ]),
    });

    const { inventory } = await buildInventory(deps);
    expect(inventory.candidates).toHaveLength(1);
  });

  it('devuelve inventario vacio cuando la enumeracion falla', async () => {
    const deps = makeDeps({
      listWindows: vi.fn(async () => {
        throw new Error('powershell no disponible');
      }),
    });

    const { inventory } = await buildInventory(deps);
    expect(inventory.candidates).toEqual([]);
  });

  it('mantiene el identificador estable entre inventarios sucesivos', async () => {
    const deps = makeDeps();
    const first = await buildInventory(deps);
    const second = await buildInventory(deps);

    expect(first.inventory.candidates.map((item) => item.id))
      .toEqual(second.inventory.candidates.map((item) => item.id));
  });

  it('fuera de Windows solo ofrece captura y se construye desde desktopCapturer', async () => {
    const listWindows = vi.fn(async () => []);
    const deps = makeDeps({ platform: 'darwin', listWindows });

    const { inventory } = await buildInventory(deps);

    expect(inventory.availableLevels).toEqual(['captura']);
    expect(availableLevelsFor('darwin')).toEqual(['captura']);
    expect(listWindows).not.toHaveBeenCalled();
    expect(inventory.candidates.map((candidate) => candidate.expectedLevel)).toEqual(['captura', 'captura']);
  });
});
