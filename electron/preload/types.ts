export type PreloadBridge = {
  exposeInMainWorld: (apiKey: string, api: unknown) => void;
};

export type IpcRendererLike = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (...args: any[]) => void) => unknown;
  off: (channel: string, listener: (...args: any[]) => void) => unknown;
  removeAllListeners: (channel: string) => void;
};

export type SafeIpc = {
  safeInvoke: (channel: string, ...args: any[]) => Promise<any>;
  safeSend: (channel: string, ...args: any[]) => void;
  safeOn: (channel: string, cb: (...args: any[]) => void) => void;
  safeRemoveAllListeners: (channel: string) => void;
  sanitizePayload: (payload: any) => any;
  validateChannel: (channel: string) => void;
};
