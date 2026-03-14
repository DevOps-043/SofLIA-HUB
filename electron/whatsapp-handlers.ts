import { ipcMain, BrowserWindow } from 'electron';
import type { WhatsAppService } from './whatsapp-service';

/**
 * Registra los manejadores IPC para el servicio de WhatsApp.
 * Facilita la comunicación entre el Renderer process (React) y el Main process (Node.js).
 */
export function registerWhatsAppHandlers(
  waService: WhatsAppService,
  getMainWindow: () => BrowserWindow | null,
  initAgent: (apiKey: string) => void
) {
  // Manejador para conectar WhatsApp
  ipcMain.handle('whatsapp:connect', async () => {
    try {
      await waService.connect();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Manejador para desconectar WhatsApp
  ipcMain.handle('whatsapp:disconnect', async () => {
    try {
      await waService.disconnect();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Manejador para obtener el estado actual
  ipcMain.handle('whatsapp:get-status', async () => {
    return waService.getStatus();
  });

  // Manejador para configurar números permitidos
  ipcMain.handle('whatsapp:set-allowed-numbers', async (_event, numbers: string[]) => {
    try {
      await waService.setAllowedNumbers(numbers);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Manejador para configurar la política de grupos
  ipcMain.handle('whatsapp:set-group-config', async (_event, config: any) => {
    try {
      await waService.setGroupConfig(config);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Manejador para guardar la API Key
  ipcMain.handle('whatsapp:set-api-key', async (_event, apiKey: string) => {
    try {
      await waService.saveApiKey(apiKey);
      initAgent(apiKey);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Reenviar eventos del servicio al Renderer a través de la ventana principal
  waService.on('qr', (qr: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('whatsapp:qr', qr);
    }
  });

  waService.on('status', (status: any) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('whatsapp:status', status);
    }
  });
}
