import { BrowserWindow } from 'electron';

export function renderHtmlToPdf(htmlContent: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    win.webContents.on('did-finish-load', async () => {
      try {
        const pdf = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          landscape: false,
        });
        win.close();
        resolve(pdf);
      } catch (error) {
        win.close();
        reject(error);
      }
    });

    win.webContents.on('did-fail-load', (_event, _code, desc) => {
      win.close();
      reject(new Error(`Error al renderizar motor web para PDF: ${desc}`));
    });
  });
}
