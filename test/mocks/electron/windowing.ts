import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

// Los permisos de una ventana real adoptada se indexan por id de webContents:
// con un id compartido, dos ventanas distintas se confundirian entre si.
let nextWebContentsId = 1;

export class BrowserWindow extends EventEmitter {
  static instances: BrowserWindow[] = [];

  webContents = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    id: nextWebContentsId++,
    session: {
      setUserAgent: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      extensions: {
        loadExtension: vi.fn(async () => ({ id: 'extension-id', name: 'Extension', version: '1.0.0' })),
        removeExtension: vi.fn(),
        getAllExtensions: vi.fn(() => []),
      },
    },
    executeJavaScript: vi.fn(),
    getUserAgent: vi.fn(() => 'Mozilla/5.0 (KHTML, like Gecko) soflia-hub-desktop/0.9.6 Chrome/152.0.7977.30 Electron/44.0.0-beta.3 Safari/537.36'),
    setUserAgent: vi.fn(),
    getURL: vi.fn(() => 'about:blank'),
    isDestroyed: vi.fn(() => false),
  };
  contentView = {
    addChildView: vi.fn(),
    removeChildView: vi.fn(),
    children: [] as unknown[],
  };

  loadURL = vi.fn();
  loadFile = vi.fn();
  show = vi.fn();
  hide = vi.fn();
  close = vi.fn();
  destroy = vi.fn();
  isDestroyed = vi.fn(() => false);
  setSize = vi.fn();
  getSize = vi.fn(() => [1024, 768]);
  setPosition = vi.fn();
  getPosition = vi.fn(() => [0, 0]);
  minimize = vi.fn();
  maximize = vi.fn();
  restore = vi.fn();
  focus = vi.fn();
  isVisible = vi.fn(() => true);
  isMinimized = vi.fn(() => false);
  isFocused = vi.fn(() => true);
  // La pantalla completa del navegador integrado cambia el estado de la
  // ventana anfitriona: el mock lo recuerda para que entrar y salir se
  // comporte como en el sistema.
  private fullScreen = false;
  setFullScreen = vi.fn((value: boolean) => { this.fullScreen = value; });
  isFullScreen = vi.fn(() => this.fullScreen);
  setAlwaysOnTop = vi.fn();
  setBounds = vi.fn();
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1024, height: 768 }));
  getContentBounds = vi.fn(() => ({ x: 0, y: 0, width: 1024, height: 768 }));
  setMenu = vi.fn();
  setTitle = vi.fn();

  static getAllWindows = vi.fn(() => []);
  static getFocusedWindow = vi.fn(() => null);

  constructor(_options?: any) {
    super();
    BrowserWindow.instances.push(this);
  }
}

export class BaseWindow extends BrowserWindow {
  static instances: BaseWindow[] = [];

  constructor(options?: unknown) {
    super(options);
    BaseWindow.instances.push(this);
  }
}

class MockWebContents extends EventEmitter {
  id = 2;
  private currentUrl = 'about:blank';
  private title = '';
  private destroyed = false;
  session = {
    getUserAgent: vi.fn(() => this.getUserAgent()),
    setUserAgent: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(),
    webRequest: {
      onBeforeSendHeaders: vi.fn(),
      onHeadersReceived: vi.fn(),
      onErrorOccurred: vi.fn(),
    },
    extensions: {
      loadExtension: vi.fn(async () => ({ id: 'extension-id', name: 'Extension', version: '1.0.0' })),
      removeExtension: vi.fn(),
      getAllExtensions: vi.fn(() => []),
    },
  };
  navigationHistory = {
    canGoBack: vi.fn(() => false),
    canGoForward: vi.fn(() => false),
    goBack: vi.fn(),
    goForward: vi.fn(),
  };
  loadURL = vi.fn(async (url: string) => {
    this.currentUrl = url;
    this.emit('did-start-loading');
    this.emit('did-navigate', {}, url, 200, 'OK');
    this.emit('did-finish-load');
    this.emit('did-stop-loading');
  });
  getURL = vi.fn(() => this.currentUrl);
  getTitle = vi.fn(() => this.title);
  getUserAgent = vi.fn(() => 'Mozilla/5.0 (KHTML, like Gecko) soflia-hub-desktop/0.9.6 Chrome/152.0.7977.30 Electron/44.0.0-beta.3 Safari/537.36');
  setUserAgent = vi.fn();
  setWindowOpenHandler = vi.fn();
  setBackgroundThrottling = vi.fn();
  focus = vi.fn();
  reload = vi.fn();
  stop = vi.fn();
  isDestroyed = vi.fn(() => this.destroyed);
  isCurrentlyAudible = vi.fn(() => false);
  isBeingCaptured = vi.fn(() => false);
  isDevToolsOpened = vi.fn(() => false);
  isLoadingMainFrame = vi.fn(() => false);
  isWaitingForResponse = vi.fn(() => false);
  close = vi.fn(() => { this.destroyed = true; });
  capturePage = vi.fn(async () => new MockNativeImage());
  sendInputEvent = vi.fn();
  insertText = vi.fn(async () => {});
  executeJavaScript = vi.fn(async () => ({ username: true, password: true }));
  executeJavaScriptInIsolatedWorld = vi.fn(async () => undefined);
}

class MockNativeImage {
  isEmpty = () => false;
  getSize = () => ({ width: 1_920, height: 1_080 });
  resize = vi.fn(() => this);
  toDataURL = () => 'data:image/png;base64,Y2FwdHVyYQ==';
  toPNG = () => Buffer.from('captura');
  toJPEG = vi.fn(() => Buffer.from('captura'));
}

export class WebContentsView extends EventEmitter {
  static instances: WebContentsView[] = [];
  webContents = new MockWebContents();
  setVisible = vi.fn();
  setBackgroundColor = vi.fn();
  private bounds = { x: 0, y: 0, width: 800, height: 600 };
  setBounds = vi.fn((bounds: { x: number; y: number; width: number; height: number }) => { this.bounds = bounds; });
  getBounds = vi.fn(() => this.bounds);

  constructor(public options?: unknown) {
    super();
    WebContentsView.instances.push(this);
  }
}

export const desktopCapturer = {
  getSources: vi.fn(async () => [
    {
      id: 'screen:0:0',
      name: 'Entire Screen',
      thumbnail: { toDataURL: () => 'data:image/png;base64,iVBOR...' },
      display_id: '0',
      appIcon: null,
    },
  ]),
};

export const powerMonitor = {
  getSystemIdleTime: vi.fn(() => 0),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
};

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    size: { width: 1920, height: 1080 },
  })),
  getAllDisplays: vi.fn(() => [
    {
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    },
  ]),
};
