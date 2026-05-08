import { app, BrowserWindow, globalShortcut } from 'electron';
import { extractProtocolArg, parseAppProtocolCommand } from '../app-protocol';
import type { MainRuntimeState } from './runtime-state';

export function registerAppLifecycle(input: { services: any; state: MainRuntimeState; controls: any }): void {
  const { services, state, controls } = input;
  app.on('second-instance', (_event, commandLine) => {
    const protocolCommand = parseAppProtocolCommand(extractProtocolArg(commandLine));
    if (protocolCommand?.type === 'share-link') {
      controls.routeShareLinkToRenderer(protocolCommand.shareLink);
      return;
    }
    if (protocolCommand?.type === 'meeting-trigger') {
      controls.routeMeetingTriggerToRenderer(protocolCommand.payload);
      return;
    }
    focusMainWindow(state, controls);
  });

  app.on('before-quit', () => {
    console.log('[BOOT] before-quit');
    state.isQuitting = true;
    globalShortcut.unregisterAll();
    services.pathMemoryService.stop();
    void services.clipboardAssistant.stop();
    services.proactiveService.stop();
    services.meetingPassiveDetectionService.stopPolling();
    if (state.tray) {
      state.tray.destroy();
      state.tray = null;
    }
  });

  app.on('window-all-closed', () => {
    console.log('[BOOT] window-all-closed');
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      controls.createWindow(true);
      return;
    }
    state.win?.show();
    state.win?.focus();
  });
  app.on('browser-window-created', () => console.log('[BOOT] Browser window created'));
  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error(`[BOOT] render-process-gone: ${details.reason} (exitCode=${details.exitCode})`);
  });
  app.on('child-process-gone', (_event, details) => {
    console.error(`[BOOT] child-process-gone: ${details.type} (${details.reason})`);
  });
}

function focusMainWindow(state: MainRuntimeState, controls: any): void {
  if (!state.win) {
    controls.createWindow(true);
    return;
  }
  if (state.win.isMinimized()) state.win.restore();
  if (!state.win.isVisible()) state.win.show();
  state.win.focus();
}
