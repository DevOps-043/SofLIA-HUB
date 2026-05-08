import { app, contextBridge, ipcMain, ipcRenderer } from './electron/app-ipc';
import { BrowserWindow, desktopCapturer, powerMonitor, screen } from './electron/windowing';
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
export { BrowserWindow, desktopCapturer, powerMonitor, screen };
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
