import type { PreloadBridge, SafeIpc } from './types';

export function exposeIntegratedBrowserApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn } = ipc;
  bridge.exposeInMainWorld('integratedBrowser', {
    getState: () => safeInvoke('integrated-browser:get-state'),
    captureVisible: () => safeInvoke('integrated-browser:capture-visible'),
    /** Cuadro fresco a resolucion del viewport, sin la cadencia pasiva. */
    captureFrame: () => safeInvoke('integrated-browser:capture-frame'),
    getPlayerState: () => safeInvoke('integrated-browser:get-player-state'),
    sampleFrames: (count: number, intervalMs: number) =>
      safeInvoke('integrated-browser:sample-frames', { count, intervalMs }),
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
    reorderTabs: (sourceId: string, targetId: string) => safeInvoke('integrated-browser:tab-reorder', { sourceId, targetId }),
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
    setOverlayBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      safeInvoke('integrated-browser:set-overlay-bounds', bounds),
    setOverlayPosition: (pos: string) =>
      safeInvoke('integrated-browser:set-overlay-position', { pos }),
    hide: () => safeInvoke('integrated-browser:hide'),
    prepareReadingMode: (input?: { sourceUrl?: string; selection?: string }) => safeInvoke('integrated-browser:reading-prepare', input ?? {}),
    synthesizeReadingSegment: (input: { readingId: string; requestId: string; start: number; end: number }) => safeInvoke('integrated-browser:reading-synthesize', input),
    highlightReadingRange: (input: { readingId: string; start?: number; end?: number }) => safeInvoke('integrated-browser:reading-highlight', input),
    waitForReadingToolbarAction: (input: { readingId: string }) => safeInvoke('integrated-browser:reading-toolbar-wait', input),
    syncReadingToolbar: (input: { readingId: string; status: 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error'; speed: number; message?: string }) => safeInvoke('integrated-browser:reading-toolbar-sync', input),
    cancelReadingSpeech: (input: { readingId: string; requestId?: string }) => safeInvoke('integrated-browser:reading-cancel', input),
    closeReadingMode: (input: { readingId: string }) => safeInvoke('integrated-browser:reading-close', input),
    listHistory: (query?: string, limit?: number) => safeInvoke('integrated-browser:history-list', { query, limit }),
    clearHistory: () => safeInvoke('integrated-browser:history-clear'),
    clearBrowsingData: (input: { categories: string[]; range: string }) =>
      safeInvoke('integrated-browser:clear-browsing-data', input),
    listCredentials: () => safeInvoke('integrated-browser:credentials-list'),
    saveCredential: (input: { id?: string; username: string; password: string }) => safeInvoke('integrated-browser:credentials-save', input),
    fillCredential: (id: string) => safeInvoke('integrated-browser:credentials-fill', { id }),
    removeCredential: (id: string) => safeInvoke('integrated-browser:credentials-remove', { id }),
    listExtensions: () => safeInvoke('integrated-browser:extensions-list'),
    installExtension: () => safeInvoke('integrated-browser:extensions-install'),
    confirmExtensionInstall: (token: string) => safeInvoke('integrated-browser:extensions-confirm-install', { token }),
    setExtensionEnabled: (installId: string, enabled: boolean) => safeInvoke('integrated-browser:extensions-set-enabled', { installId, enabled }),
    removeExtension: (installId: string) => safeInvoke('integrated-browser:extensions-remove', { installId }),
    getSitePermissions: () => safeInvoke('integrated-browser:site-permissions-get'),
    setSitePermission: (input: { origin?: string; kind: string; state: 'ask' | 'granted' | 'denied' }) =>
      safeInvoke('integrated-browser:site-permissions-set', input),
    resetSitePermissions: (input?: { origin?: string }) =>
      safeInvoke('integrated-browser:site-permissions-reset', input ?? {}),
    getTabSummaries: () => safeInvoke('integrated-browser:tab-summaries'),
    getTabContent: (tabId: string) => safeInvoke('integrated-browser:get-tab-content', { tabId }),
    onStateChanged: (callback: (state: unknown) => void) => safeOn('integrated-browser:state-changed', callback),
    onOpenRequested: (callback: (request: unknown) => void) => safeOn('integrated-browser:open-requested', callback),
    onSelectionAction: (callback: (request: unknown) => void) => safeOn('integrated-browser:selection-action', callback),
    onReadingModeRequested: (callback: (request: unknown) => void) => safeOn('integrated-browser:reading-mode-requested', callback),
    onWritingRequest: (callback: (request: unknown) => void) => safeOn('integrated-browser:writing-request', callback),
    resolveWriting: (input: { requestId: string; text?: string; error?: string }) =>
      safeInvoke('integrated-browser:writing-resolve', input),
    onSitePermissionsChanged: (callback: (payload: unknown) => void) => safeOn('integrated-browser:site-permissions-changed', callback),
    decidePermissionPrompt: (input: { id: string; granted: boolean }) =>
      safeInvoke('integrated-browser:permission-decide', input),
    onPermissionPrompt: (callback: (request: unknown) => void) => safeOn('integrated-browser:permission-prompt', callback),
  });
}
