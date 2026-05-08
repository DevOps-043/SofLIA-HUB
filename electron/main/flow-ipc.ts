import { ipcMain } from 'electron';
import { restoreFlowInsertTarget } from '../flow-window/native-window-target';
import { logBootstrapError } from './bootstrap-steps';
import type { MainRuntimeState } from './runtime-state';

export function registerFlowIpcHandlers(input: { services: any; state: MainRuntimeState; controls: any }): void {
  const { services, state, controls } = input;
  ipcMain.on('flow-send-to-chat', (_event, text: string) => {
    if (!state.win) controls.createWindow(true);
    if (!state.win) return;
    if (!state.win.isVisible()) state.win.show();
    if (state.win.isMinimized()) state.win.restore();
    state.win.focus();
    state.win.webContents.send('flow-message-received', text);
  });

  ipcMain.handle('flow:insert-text', async (_event, text: string) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return { success: false, error: 'No hay texto para insertar.' };
    if (!state.flowInsertTarget?.handle) {
      return { success: false, code: 'NO_TARGET', error: 'No hay un campo activo listo para dictado.' };
    }
    try {
      state.flowWin?.hide();
      await new Promise((resolve) => setTimeout(resolve, 140));
      await restoreFlowInsertTarget(state.flowInsertTarget, logBootstrapError);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await services.desktopAgentService.keyboardType(normalizedText);
      return { success: true };
    } catch (error) {
      state.flowWin?.showInactive();
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.on('close-flow', () => {
    state.flowWin?.hide();
  });
}
