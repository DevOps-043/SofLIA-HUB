import { desktopCapturer, ipcMain } from 'electron';

export type ScreenCaptureErrorLogger = (context: string, error: unknown) => void;

export function registerScreenCaptureHandlers(logError: ScreenCaptureErrorLogger): void {
  ipcMain.handle('capture-screen', async (_event, sourceId?: string) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      if (!sources.length) {
        return null;
      }

      const source = sourceId ? sources.find((item) => item.id === sourceId) || sources[0] : sources[0];
      return source.thumbnail.toDataURL();
    } catch {
      return null;
    }
  });

  ipcMain.handle('get-screen-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        isScreen: source.id.startsWith('screen:'),
      }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      return sources.map((source) => ({
        display_id: source.id,
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
    } catch (error) {
      logError('get-desktop-sources', error);
      return [];
    }
  });
}
