import type { PreloadBridge, SafeIpc } from './types';

export function exposeIntegratedBrowserApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn } = ipc;
  bridge.exposeInMainWorld('integratedBrowser', {
    getState: () => safeInvoke('integrated-browser:get-state'),
    open: (url?: string) => safeInvoke('integrated-browser:open', url === undefined ? {} : { url }),
    navigate: (target: string) => safeInvoke('integrated-browser:navigate', { target }),
    goBack: () => safeInvoke('integrated-browser:go-back'),
    goForward: () => safeInvoke('integrated-browser:go-forward'),
    reload: () => safeInvoke('integrated-browser:reload'),
    stop: () => safeInvoke('integrated-browser:stop'),
    focus: () => safeInvoke('integrated-browser:focus'),
    setViewport: (viewport: { x: number; y: number; width: number; height: number }) =>
      safeInvoke('integrated-browser:set-viewport', viewport),
    hide: () => safeInvoke('integrated-browser:hide'),
    onStateChanged: (callback: (state: unknown) => void) => safeOn('integrated-browser:state-changed', callback),
    onOpenRequested: (callback: (request: unknown) => void) => safeOn('integrated-browser:open-requested', callback),
  });
}
