import type {
  IpcRendererLike,
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeCoreApis(
  bridge: PreloadBridge,
  ipcRenderer: IpcRendererLike,
  safeIpc: SafeIpc,
  runtimeConfig: unknown,
): void {
  const { safeInvoke, safeRemoveAllListeners, safeSend, sanitizePayload, validateChannel } = safeIpc;
  bridge.exposeInMainWorld('ipcRenderer', {
    on(channel: string, listener: (...args: any[]) => void) {
      validateChannel(channel);
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args.map(sanitizePayload)));
    },
    off(channel: string, listener: (...args: any[]) => void) {
      validateChannel(channel);
      return ipcRenderer.off(channel, listener);
    },
    send: safeSend,
    invoke: safeInvoke,
    removeAllListeners: safeRemoveAllListeners,
  });

  bridge.exposeInMainWorld('appRuntime', runtimeConfig);
  bridge.exposeInMainWorld('screenCapture', {
    captureScreen: (sourceId?: string): Promise<string | null> => safeInvoke('capture-screen', sourceId),
    getScreenSources: (): Promise<Array<{ id: string; name: string; thumbnail: string; isScreen: boolean }>> =>
      safeInvoke('get-screen-sources'),
  });
  bridge.exposeInMainWorld('windowControls', {
    minimize: () => safeInvoke('app:window-minimize'),
    maximize: () => safeInvoke('app:window-maximize'),
    close: () => safeInvoke('app:window-close'),
    isMaximized: () => safeInvoke('app:window-is-maximized'),
    getPlatform: () => safeInvoke('app:window-get-platform'),
  });
}
