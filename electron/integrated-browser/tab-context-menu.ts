import type { MenuItemConstructorOptions } from 'electron';
import { browserShortcutAccelerator } from '../../src/shared/browser-keyboard-shortcuts';

/** Estado de la pestaña sobre la que se abre el menú. */
export interface BrowserTabMenuTarget {
  pinned: boolean;
  muted: boolean;
  detached: boolean;
  hasTabsToRight: boolean;
  hasOtherTabs: boolean;
  canReopen: boolean;
}

export interface BrowserTabMenuActions {
  onNewTab(): void;
  onDuplicate(): void;
  onTogglePinned(): void;
  onToggleMuted(): void;
  onEditGroup(): void;
  onMoveToWindow(): void;
  onClose(): void;
  onCloseOthers(): void;
  onCloseToRight(): void;
  onReopenClosed(): void;
}

/**
 * Menú contextual de una pestaña con el orden de Chrome. Las acciones sobre la
 * pestaña viven aquí y no en el menú general: así el menú de herramientas queda
 * para el navegador y no para una pestaña concreta. Los aceleradores sólo se
 * muestran; el atajo real lo resuelve la tabla compartida.
 */
export function buildTabContextMenuTemplate(target: BrowserTabMenuTarget, actions: BrowserTabMenuActions): MenuItemConstructorOptions[] {
  const shortcut = (command: Parameters<typeof browserShortcutAccelerator>[0]) => ({
    accelerator: browserShortcutAccelerator(command),
    registerAccelerator: false,
  });
  return [
    { label: 'Nueva pestaña', ...shortcut('new-tab'), click: actions.onNewTab },
    { type: 'separator' },
    { label: 'Duplicar', click: actions.onDuplicate },
    { label: target.pinned ? 'Dejar de fijar' : 'Fijar', click: actions.onTogglePinned },
    { label: target.muted ? 'Activar sonido de la pestaña' : 'Silenciar pestaña', click: actions.onToggleMuted },
    { label: 'Agregar pestaña a un grupo…', click: actions.onEditGroup },
    { label: 'Mover pestaña a una ventana nueva', enabled: !target.detached, click: actions.onMoveToWindow },
    { type: 'separator' },
    { label: 'Cerrar', ...shortcut('close-tab'), click: actions.onClose },
    { label: 'Cerrar otras pestañas', enabled: target.hasOtherTabs, click: actions.onCloseOthers },
    { label: 'Cerrar pestañas a la derecha', enabled: target.hasTabsToRight, click: actions.onCloseToRight },
    { type: 'separator' },
    { label: 'Reabrir pestaña cerrada', ...shortcut('reopen-tab'), enabled: target.canReopen, click: actions.onReopenClosed },
  ];
}
