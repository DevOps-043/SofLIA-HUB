import { describe, expect, it, vi } from 'vitest';
import { Menu } from 'electron';
import { buildBrowserContextMenu, buildSelectionInstruction } from '../integrated-browser/context-menu';

type MenuTemplate = Electron.MenuItemConstructorOptions[];

const menuHarness = Menu as unknown as { buildFromTemplate: ReturnType<typeof vi.fn> };

function fakeContents() {
  return {
    inspectElement: vi.fn(),
    reload: vi.fn(),
    navigationHistory: { canGoBack: () => true, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
  } as unknown as Electron.WebContents;
}

function buildMenu(overrides: Partial<Electron.ContextMenuParams> = {}) {
  const onSelectionAction = vi.fn();
  const onOpenReadingMode = vi.fn();
  const params = {
    selectionText: '',
    isEditable: false,
    x: 10,
    y: 20,
    pageURL: 'https://mail.google.com/chat',
    ...overrides,
  } as Electron.ContextMenuParams;

  buildBrowserContextMenu({
    contents: fakeContents(),
    params,
    pageTitle: 'Correo de SofLIA',
    onSelectionAction,
    onOpenReadingMode,
  });

  const calls = menuHarness.buildFromTemplate.mock.calls;
  const template = calls[calls.length - 1]?.[0] as MenuTemplate;
  const labels = template.map((item) => item.label).filter(Boolean) as string[];
  return { template, labels, onSelectionAction, onOpenReadingMode };
}

describe('Menú contextual del navegador integrado', () => {
  it('CM-001: con texto seleccionado ofrece las acciones de SofLIA', () => {
    const { labels } = buildMenu({ selectionText: '  Concepto 3.2: Synapse Bridge  ' });

    expect(labels).toEqual(expect.arrayContaining([
      'Preguntar a SofLIA', 'Mejorar la redacción', 'Traducir', 'Resumir',
      'Copiar', 'Abrir en modo lectura', 'Inspeccionar',
    ]));
  });

  it('CM-002: sin selección no ofrece acciones que necesitan texto', () => {
    const { labels } = buildMenu();

    expect(labels).not.toContain('Mejorar la redacción');
    expect(labels).not.toContain('Traducir');
    expect(labels).toEqual(expect.arrayContaining(['Abrir en modo lectura', 'Recargar', 'Inspeccionar']));
  });

  it('CM-003: la acción entrega la selección recortada y su procedencia', () => {
    const { template, onSelectionAction } = buildMenu({ selectionText: 'x'.repeat(9_000) });

    const improve = template.find((item) => item.label === 'Mejorar la redacción');
    improve?.click?.(undefined as never, undefined, undefined as never);

    expect(onSelectionAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'improve',
      url: 'https://mail.google.com/chat',
      title: 'Correo de SofLIA',
    }));
    // Una seleccion enorme no debe arrastrar la pagina entera al chat.
    expect(onSelectionAction.mock.calls[0][0].text).toHaveLength(8_000);
  });

  it('CM-004: en un campo editable agrega cortar, pegar y seleccionar todo', () => {
    const { template } = buildMenu({ isEditable: true });
    const roles = template.map((item) => item.role).filter(Boolean);

    expect(roles).toEqual(expect.arrayContaining(['cut', 'paste', 'selectAll']));
  });

  it('CM-005: inspeccionar apunta a las coordenadas del clic', () => {
    const contents = fakeContents();
    buildBrowserContextMenu({
      contents,
      params: { selectionText: '', isEditable: false, x: 640, y: 480, pageURL: 'https://ejemplo.com' } as Electron.ContextMenuParams,
      pageTitle: 'Ejemplo',
      onSelectionAction: vi.fn(),
      onOpenReadingMode: vi.fn(),
    });
    const calls = menuHarness.buildFromTemplate.mock.calls;
    const template = calls[calls.length - 1]?.[0] as MenuTemplate;

    template.find((item) => item.label === 'Inspeccionar')?.click?.(undefined as never, undefined, undefined as never);

    expect(contents.inspectElement).toHaveBeenCalledWith(640, 480);
  });

  it('CM-008: el lector recibe una seleccion amplia sin el limite del adjunto de chat', () => {
    const { template, onOpenReadingMode } = buildMenu({ selectionText: 'x'.repeat(60_000) });

    template.find((item) => item.label === 'Abrir en modo lectura')?.click?.(undefined as never, undefined, undefined as never);

    expect(onOpenReadingMode).toHaveBeenCalledTimes(1);
    expect(onOpenReadingMode.mock.calls[0][0]).toHaveLength(50_000);
  });
});

describe('Instrucción sugerida de la selección', () => {
  it('CM-006: preguntar a SofLIA no precarga nada; solo adjunta el contexto', () => {
    // El compositor debe quedar vacio para que el usuario escriba su peticion;
    // ninguna accion del menu envia el turno por su cuenta.
    expect(buildSelectionInstruction('ask')).toBe('');
  });

  it('CM-007: cada acción concreta pide adaptar el registro sin andamiaje visible', () => {
    const acciones = ['improve', 'translate', 'summarize'] as const;

    for (const accion of acciones) {
      const instruccion = buildSelectionInstruction(accion);
      expect(instruccion.length).toBeGreaterThan(0);
      expect(instruccion).not.toContain('NO_CONFIABLE');
      expect(instruccion).not.toContain('Fuente:');
    }
    expect(buildSelectionInstruction('improve')).toContain('Ajusta el registro');
    expect(buildSelectionInstruction('translate')).toContain('Traduce');
    expect(buildSelectionInstruction('summarize')).toContain('Resume');
  });
});
