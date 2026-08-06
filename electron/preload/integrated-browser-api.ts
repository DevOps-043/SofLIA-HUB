import type { PreloadBridge, SafeIpc } from './types';

export function exposeIntegratedBrowserApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn } = ipc;
  bridge.exposeInMainWorld('integratedBrowser', {
    getState: () => safeInvoke('integrated-browser:get-state'),
    captureVisible: () => safeInvoke('integrated-browser:capture-visible'),
    getObservation: (forceFresh = false) => safeInvoke('integrated-browser:get-observation', { forceFresh }),
    setObservationEnabled: (enabled: boolean) => safeInvoke('integrated-browser:set-observation-enabled', { enabled }),
    open: (url?: string) => safeInvoke('integrated-browser:open', url === undefined ? {} : { url }),
    navigate: (target: string) => safeInvoke('integrated-browser:navigate', { target }),
    clickElement: (ref: string) => safeInvoke('integrated-browser:element-click', { ref }),
    typeInElement: (ref: string, text: string, submit = false) =>
      safeInvoke('integrated-browser:element-type', { ref, text, submit }),
    scrollView: (direction: 'up' | 'down' | 'left' | 'right', amount?: number) =>
      safeInvoke('integrated-browser:scroll', { direction, amount }),
    createTab: (url?: string) => safeInvoke('integrated-browser:tab-create', url === undefined ? {} : { url }),
    closeTab: (tabId: string) => safeInvoke('integrated-browser:tab-close', { tabId }),
    activateTab: (tabId: string) => safeInvoke('integrated-browser:tab-activate', { tabId }),
    detachTab: (tabId: string) => safeInvoke('integrated-browser:tab-detach', { tabId }),
    reattachTab: (tabId: string) => safeInvoke('integrated-browser:tab-reattach', { tabId }),
    setViewMode: (mode: 'single' | 'split' | 'overlay', secondaryTabId?: string) =>
      safeInvoke('integrated-browser:view-mode', { mode, secondaryTabId }),
    goBack: () => safeInvoke('integrated-browser:go-back'),
    goForward: () => safeInvoke('integrated-browser:go-forward'),
    reload: () => safeInvoke('integrated-browser:reload'),
    stop: () => safeInvoke('integrated-browser:stop'),
    focus: () => safeInvoke('integrated-browser:focus'),
    toggleDevTools: () => safeInvoke('integrated-browser:toggle-devtools'),
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
    confirmExtensionInstall: (token: string) => safeInvoke('integrated-browser:extensions-confirm-install', { token }),
    setExtensionEnabled: (installId: string, enabled: boolean) => safeInvoke('integrated-browser:extensions-set-enabled', { installId, enabled }),
    removeExtension: (installId: string) => safeInvoke('integrated-browser:extensions-remove', { installId }),
    onStateChanged: (callback: (state: unknown) => void) => safeOn('integrated-browser:state-changed', callback),
    onOpenRequested: (callback: (request: unknown) => void) => safeOn('integrated-browser:open-requested', callback),
  });
}
