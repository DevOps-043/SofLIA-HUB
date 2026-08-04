import { app, contextBridge, ipcMain, ipcRenderer } from './electron/app-ipc';
import { BrowserWindow, WebContentsView, desktopCapturer, powerMonitor, screen } from './electron/windowing';
import {
  Menu,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  nativeImage,
  safeStorage,
  shell,
} from './electron/system-ui';

export { app, contextBridge, ipcMain, ipcRenderer };
export { BrowserWindow, WebContentsView, desktopCapturer, powerMonitor, screen };
export {
  Menu,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  nativeImage,
  safeStorage,
  shell,
};

export default {
  app,
  ipcMain,
  ipcRenderer,
  contextBridge,
  BrowserWindow,
  WebContentsView,
  desktopCapturer,
  powerMonitor,
  shell,
  clipboard,
  safeStorage,
  dialog,
  Tray,
  Menu,
  nativeImage,
  screen,
  globalShortcut,
};
