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
    listHistory: (query?: string, limit?: number) => safeInvoke('integrated-browser:history-list', { query, limit }),
    clearHistory: () => safeInvoke('integrated-browser:history-clear'),
    listCredentials: () => safeInvoke('integrated-browser:credentials-list'),
    saveCredential: (input: { id?: string; username: string; password: string }) => safeInvoke('integrated-browser:credentials-save', input),
    fillCredential: (id: string) => safeInvoke('integrated-browser:credentials-fill', { id }),
    removeCredential: (id: string) => safeInvoke('integrated-browser:credentials-remove', { id }),
    listExtensions: () => safeInvoke('integrated-browser:extensions-list'),
    installExtension: () => safeInvoke('integrated-browser:extensions-install'),
    setExtensionEnabled: (installId: string, enabled: boolean) => safeInvoke('integrated-browser:extensions-set-enabled', { installId, enabled }),
    removeExtension: (installId: string) => safeInvoke('integrated-browser:extensions-remove', { installId }),
    onStateChanged: (callback: (state: unknown) => void) => safeOn('integrated-browser:state-changed', callback),
    onOpenRequested: (callback: (request: unknown) => void) => safeOn('integrated-browser:open-requested', callback),
  });
}
