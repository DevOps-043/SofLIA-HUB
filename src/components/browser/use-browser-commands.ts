import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  integratedBrowserService,
  type IntegratedBrowserResponse,
  type IntegratedBrowserState,
} from '../../services/integrated-browser-service';
import { resolveBrowserShortcut, type BrowserUiCommandRequest } from '../../shared/browser-keyboard-shortcuts';
import type { BrowserManagementTab } from './BrowserManagementPanel';

/** Plataforma en el formato de `process.platform` que espera la tabla de atajos. */
export function rendererShortcutPlatform(): string {
  return typeof navigator !== 'undefined' && /^mac/i.test(navigator.platform) ? 'darwin' : 'other';
}

/** Acciones de la interfaz que el panel conserva como estado propio. */
export interface BrowserCommandUiActions {
  openFind(): void;
  focusAddress(): void;
  toggleManagement(tab: BrowserManagementTab): void;
  toggleBookmarksBar(): void;
  toggleBookmark(): void;
  editTabGroup(tabId: string): void;
}

/**
 * Ejecuta los atajos y las órdenes de menús nativos del navegador.
 *
 * Las teclas pulsadas con el foco en la página llegan reenviadas por main;
 * las pulsadas en la barra del navegador se resuelven aquí con la misma tabla.
 * Las del chat de SofLIA no se interceptan: Ctrl+W o Ctrl+T allí no deben
 * cerrar ni abrir pestañas.
 */
export function useBrowserCommands(input: {
  rootRef: RefObject<HTMLElement | null>;
  state: IntegratedBrowserState;
  run: (operation: () => Promise<IntegratedBrowserResponse>) => Promise<void>;
  actions: BrowserCommandUiActions;
}): void {
  // Los manejadores leen siempre las props del último render confirmado.
  const latest = useRef(input);
  useEffect(() => { latest.current = input; });

  const execute = useCallback((request: BrowserUiCommandRequest) => {
    const { state, run, actions } = latest.current;
    const service = integratedBrowserService;
    const tabs = state.tabs.filter((tab) => !tab.isDetached);
    const activeId = state.activeTabId;
    const activate = (index: number) => {
      const target = tabs[index];
      if (target && target.id !== activeId) void run(() => service.activateTab(target.id));
    };
    const cycle = (delta: number) => {
      if (tabs.length < 2) return;
      const current = Math.max(0, tabs.findIndex((tab) => tab.id === activeId));
      activate((current + delta + tabs.length) % tabs.length);
    };
    const { command } = request;
    if (command.startsWith('select-tab-')) {
      activate(Number(command.slice('select-tab-'.length)) - 1);
      return;
    }
    switch (command) {
      case 'new-tab': void run(() => service.createTab()); break;
      case 'close-tab': if (activeId) void run(() => service.closeTab(activeId)); break;
      case 'reopen-tab': void run(service.reopenClosedTab); break;
      case 'next-tab': cycle(1); break;
      case 'previous-tab': cycle(-1); break;
      case 'select-last-tab': activate(tabs.length - 1); break;
      case 'focus-address': actions.focusAddress(); break;
      case 'reload': void run(service.reload); break;
      case 'back': if (state.canGoBack) void run(service.goBack); break;
      case 'forward': if (state.canGoForward) void run(service.goForward); break;
      case 'find': actions.openFind(); break;
      case 'print': void run(service.printPage); break;
      case 'zoom-in': void run(() => service.setZoom('in')); break;
      case 'zoom-out': void run(() => service.setZoom('out')); break;
      case 'zoom-reset': void run(() => service.setZoom('reset')); break;
      case 'fullscreen': void run(service.toggleFullscreen); break;
      case 'devtools': void run(service.toggleDevTools); break;
      case 'history': actions.toggleManagement('history'); break;
      case 'downloads': actions.toggleManagement('downloads'); break;
      case 'bookmark-manager': actions.toggleManagement('bookmarks'); break;
      case 'clear-data': actions.toggleManagement('privacy'); break;
      case 'bookmarks-bar': actions.toggleBookmarksBar(); break;
      case 'bookmark-page': actions.toggleBookmark(); break;
      case 'edit-tab-group': {
        const tabId = request.tabId ?? activeId;
        if (tabId) actions.editTabGroup(tabId);
        break;
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = latest.current.rootRef.current;
      // Sin foco en ningún control el evento llega al body; también es del navegador.
      const target = event.target;
      if (!root || !(target instanceof Node) || (target !== document.body && !root.contains(target))) return;
      const command = resolveBrowserShortcut({
        key: event.key, control: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, alt: event.altKey,
      }, rendererShortcutPlatform());
      if (!command) return;
      event.preventDefault();
      execute({ command });
    };
    window.addEventListener('keydown', handleKeyDown);
    const unsubscribe = integratedBrowserService.isAvailable()
      ? integratedBrowserService.subscribe({ onCommand: execute })
      : () => undefined;
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, [execute]);
}
