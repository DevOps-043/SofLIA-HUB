import { app, contextBridge, ipcMain, ipcRenderer, protocol, session } from './electron/app-ipc';
import { BaseWindow, BrowserWindow, WebContentsView, desktopCapturer, powerMonitor, screen } from './electron/windowing';
import {
  Menu,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  nativeImage,
  safeStorage,
  shell,
  systemPreferences,
} from './electron/system-ui';

export { app, contextBridge, ipcMain, ipcRenderer, protocol, session };
export { BaseWindow, BrowserWindow, WebContentsView, desktopCapturer, powerMonitor, screen };
export {
  Menu,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  nativeImage,
  safeStorage,
  shell,
  systemPreferences,
};

export default {
  app,
  ipcMain,
  ipcRenderer,
  contextBridge,
  protocol,
  session,
  BrowserWindow,
  BaseWindow,
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
  systemPreferences,
};
