import { describe, expect, it, vi } from 'vitest';
import {
  browserShortcutAccelerator,
  browserShortcutLabel,
  isBrowserUiCommandRequest,
  resolveBrowserShortcut,
  type BrowserKeyInput,
} from '../../src/shared/browser-keyboard-shortcuts';
import { buildTabContextMenuTemplate, type BrowserTabMenuTarget } from '../integrated-browser/tab-context-menu';

const key = (value: string, mods: Partial<BrowserKeyInput> = {}): BrowserKeyInput => ({
  key: value, control: false, meta: false, shift: false, alt: false, ...mods,
});

describe('atajos de teclado del navegador', () => {
  it('BR-KEY-003: resuelve las combinaciones de Chrome en Windows', () => {
    const cases: Array<[BrowserKeyInput, string]> = [
      [key('t', { control: true }), 'new-tab'],
      [key('T', { control: true, shift: true }), 'reopen-tab'],
      [key('w', { control: true }), 'close-tab'],
      [key('F4', { control: true }), 'close-tab'],
      [key('Tab', { control: true }), 'next-tab'],
      [key('Tab', { control: true, shift: true }), 'previous-tab'],
      [key('PageUp', { control: true }), 'previous-tab'],
      [key('3', { control: true }), 'select-tab-3'],
      [key('9', { control: true }), 'select-last-tab'],
      [key('l', { control: true }), 'focus-address'],
      [key('d', { alt: true }), 'focus-address'],
      [key('F5'), 'reload'],
      [key('ArrowLeft', { alt: true }), 'back'],
      [key('=', { control: true }), 'zoom-in'],
      [key('+', { control: true, shift: true }), 'zoom-in'],
      [key('-', { control: true }), 'zoom-out'],
      [key('0', { control: true }), 'zoom-reset'],
      [key('h', { control: true }), 'history'],
      [key('j', { control: true }), 'downloads'],
      [key('d', { control: true }), 'bookmark-page'],
      [key('B', { control: true, shift: true }), 'bookmarks-bar'],
      [key('Delete', { control: true, shift: true }), 'clear-data'],
      [key('F11'), 'fullscreen'],
      [key('F12'), 'devtools'],
    ];
    for (const [input, command] of cases) expect(resolveBrowserShortcut(input, 'win32')).toBe(command);
  });

  it('BR-KEY-004: no roba combinaciones propias de la página ni del sistema', () => {
    for (const input of [
      key('c', { control: true }), key('v', { control: true }), key('a', { control: true }), key('z', { control: true }),
      key('f'), key('w', { control: true, alt: true }), key('F4', { alt: true }), key('t', { control: true, meta: true }),
    ]) expect(resolveBrowserShortcut(input, 'win32')).toBeNull();
  });

  it('usa Cmd en macOS y lo muestra en las etiquetas', () => {
    expect(resolveBrowserShortcut(key('t', { meta: true }), 'darwin')).toBe('new-tab');
    expect(resolveBrowserShortcut(key('t', { control: true }), 'darwin')).toBeNull();
    expect(browserShortcutLabel('reopen-tab', 'darwin')).toBe('⌘+Mayús+T');
    expect(browserShortcutLabel('clear-data', 'win32')).toBe('Ctrl+Mayús+Supr');
    expect(browserShortcutAccelerator('reopen-tab')).toBe('CmdOrCtrl+Shift+T');
  });

  it('valida las órdenes recibidas por IPC', () => {
    expect(isBrowserUiCommandRequest({ command: 'find' })).toBe(true);
    expect(isBrowserUiCommandRequest({ command: 'edit-tab-group', tabId: 'tab-1' })).toBe(true);
    expect(isBrowserUiCommandRequest({ command: 'rm -rf' })).toBe(false);
    expect(isBrowserUiCommandRequest({ command: 'find', tabId: 4 })).toBe(false);
    expect(isBrowserUiCommandRequest({ command: 'find', tabId: 'x'.repeat(81) })).toBe(false);
    expect(isBrowserUiCommandRequest(null)).toBe(false);
  });
});

describe('menú contextual de pestaña', () => {
  const target: BrowserTabMenuTarget = { pinned: false, muted: false, detached: false, hasTabsToRight: false, hasOtherTabs: true, canReopen: false };
  const actions = {
    onNewTab: vi.fn(), onDuplicate: vi.fn(), onTogglePinned: vi.fn(), onToggleMuted: vi.fn(), onEditGroup: vi.fn(),
    onMoveToWindow: vi.fn(), onClose: vi.fn(), onCloseOthers: vi.fn(), onCloseToRight: vi.fn(), onReopenClosed: vi.fn(),
  };

  it('BR-TAB-003: sigue el orden de Chrome y deshabilita lo que no aplica', () => {
    const template = buildTabContextMenuTemplate(target, actions);
    const byLabel = (label: string) => template.find((item) => item.label === label)!;
    expect(template.filter((item) => item.label).map((item) => item.label)).toEqual([
      'Nueva pestaña', 'Duplicar', 'Fijar', 'Silenciar pestaña', 'Agregar pestaña a un grupo…', 'Mover pestaña a una ventana nueva',
      'Cerrar', 'Cerrar otras pestañas', 'Cerrar pestañas a la derecha', 'Reabrir pestaña cerrada',
    ]);
    expect(byLabel('Cerrar pestañas a la derecha').enabled).toBe(false);
    expect(byLabel('Reabrir pestaña cerrada').enabled).toBe(false);
    expect(byLabel('Cerrar')).toMatchObject({ accelerator: 'CmdOrCtrl+W', registerAccelerator: false });
  });

  it('refleja el estado fijado, silenciado y separado', () => {
    const labels = buildTabContextMenuTemplate({ ...target, pinned: true, muted: true, detached: true }, actions);
    expect(labels.map((item) => item.label)).toEqual(expect.arrayContaining(['Dejar de fijar', 'Activar sonido de la pestaña']));
    expect(labels.find((item) => item.label === 'Mover pestaña a una ventana nueva')?.enabled).toBe(false);
  });
});
